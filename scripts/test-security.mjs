import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-dlp-web-sec-'));
const binDir = path.join(tempRoot, 'bin');
const downloadsDir = path.join(tempRoot, 'downloads');
const configDir = path.join(tempRoot, 'config');
fs.mkdirSync(binDir, { recursive: true });
fs.mkdirSync(downloadsDir, { recursive: true });
fs.mkdirSync(configDir, { recursive: true });

const fakeRunnerPath = path.join(binDir, 'fake-ytdlp.mjs');
fs.writeFileSync(
  fakeRunnerPath,
  `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const url = args[args.length - 1] || '';

if (args.includes('-J')) {
  const delay = Number(process.env.FAKE_YTDLP_ANALYZE_DELAY_MS || 150);
  const json = {
    id: 'fake-id',
    title: 'Fake title',
    uploader: 'Fake uploader',
    duration: 12,
    view_count: 34,
    upload_date: '20260223',
    extractor_key: 'Fake',
    thumbnail: 'https://example.com/thumb.jpg',
    webpage_url: url,
    formats: []
  };
  setTimeout(() => {
    process.stdout.write(JSON.stringify(json));
    process.exit(0);
  }, delay);
  return;
}

const outputIdx = args.lastIndexOf('-o');
const template = outputIdx >= 0 ? args[outputIdx + 1] : path.join(process.cwd(), 'downloads', '%(title)s.%(ext)s');
const title = url.includes('slow') ? 'slow-job' : 'fast-job';
const ext = args.includes('--extract-audio') ? 'mp3' : 'mp4';
let filePath = template.replace(/%\\(title\\)s/g, title).replace(/%\\(ext\\)s/g, ext);

console.log('[download] Destination: ' + filePath);
const delay = url.includes('slow') ? 1500 : 250;
setTimeout(() => {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'fake');
  } catch {}
  console.log('[download] 100% of 1.00MiB at 1.00MiB/s ETA 00:00');
  process.exit(0);
}, delay);
`,
  'utf8'
);

if (process.platform === 'win32') {
  fs.writeFileSync(path.join(binDir, 'yt-dlp.cmd'), `@echo off\r\nnode "%~dp0\\\\fake-ytdlp.mjs" %*\r\n`, 'utf8');
} else {
  const shimPath = path.join(binDir, 'yt-dlp');
  fs.writeFileSync(shimPath, `#!/usr/bin/env sh\nnode "$(dirname "$0")/fake-ytdlp.mjs" "$@"\n`, 'utf8');
  fs.chmodSync(shimPath, 0o755);
}

const port = String(4602);
const baseUrl = `http://127.0.0.1:${port}`;
const apiToken = 'security-test-token';
const serverEnv = {
  ...process.env,
  NODE_ENV: 'production',
  HOST: '127.0.0.1',
  PORT: port,
  API_TOKEN: apiToken,
  REQUIRE_API_TOKEN: 'true',
  DOWNLOAD_PATH: downloadsDir,
  CONFIG_PATH: configDir,
  DATABASE_PATH: path.join(configDir, 'history.json'),
  COOKIE_PATH: path.join(configDir, 'cookies.txt'),
  MAX_CONCURRENT_DOWNLOADS: '1',
  MAX_RESOURCE_UNITS: '12',
  MIN_FREE_MEM_MB: '64',
  MEM_PER_RESOURCE_UNIT_MB: '128',
  ANALYZE_CONCURRENCY: '2',
  PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`
};

const server = spawn('node', ['dist/server.cjs'], {
  cwd: process.cwd(),
  env: serverEnv,
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverLogs = '';
server.stdout?.on('data', (chunk) => {
  serverLogs += chunk.toString();
});
server.stderr?.on('data', (chunk) => {
  serverLogs += chunk.toString();
});

const stopServer = async () => {
  if (server.killed) return;
  server.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => server.once('exit', resolve)),
    sleep(2000)
  ]);
};

const fetchJson = async (url, init = {}) => {
  const response = await fetch(url, init);
  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { response, json };
};

const waitForHealth = async () => {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await sleep(200);
  }
  throw new Error('Server did not become healthy in time.');
};

const authHeaders = {
  'x-api-token': apiToken,
  'Content-Type': 'application/json'
};

try {
  await waitForHealth();

  // 1) Auth required for protected endpoints.
  {
    const unauth = await fetch(`${baseUrl}/api/history`);
    assert.equal(unauth.status, 401, 'Expected unauthorized history access to return 401');

    const auth = await fetch(`${baseUrl}/api/history`, { headers: { 'x-api-token': apiToken } });
    assert.equal(auth.status, 200, 'Expected authorized history access to return 200');
  }

  // 2) SSRF guard blocks private/loopback targets.
  {
    const { response, json } = await fetchJson(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ urls: ['http://127.0.0.1/internal'] })
    });
    assert.equal(response.status, 400, 'Expected SSRF blocked URL to return 400');
    assert.ok(json?.error, 'Expected error payload for blocked SSRF URL');
  }

  // 3) Ticket flow for SSE/file scopes.
  let pausedJobId = '';
  {
    const { response, json } = await fetchJson(`${baseUrl}/api/download`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        url: 'http://8.8.8.8/paused',
        options: { autoStart: false, quality: 'audio', format: 'mp3' }
      })
    });
    assert.equal(response.status, 200, 'Expected paused job creation to succeed');
    pausedJobId = String(json?.id || '');
    assert.ok(pausedJobId, 'Expected paused job id');

    const noTicket = await fetch(`${baseUrl}/api/download/${pausedJobId}/progress`);
    assert.equal(noTicket.status, 401, 'Expected SSE without ticket/token to be unauthorized');

    const sseTicketResp = await fetchJson(`${baseUrl}/api/auth/ticket`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ scope: 'sse', jobId: pausedJobId })
    });
    assert.equal(sseTicketResp.response.status, 200, 'Expected SSE ticket issuance');
    const sseTicket = String(sseTicketResp.json?.ticket || '');
    assert.ok(sseTicket, 'Expected non-empty SSE ticket');

    const sseResponse = await fetch(`${baseUrl}/api/download/${pausedJobId}/progress?ticket=${encodeURIComponent(sseTicket)}`);
    assert.equal(sseResponse.status, 200, 'Expected SSE with ticket to be authorized');
    const contentType = sseResponse.headers.get('content-type') || '';
    assert.ok(contentType.includes('text/event-stream'), 'Expected SSE content type');
    sseResponse.body?.cancel();

    const fileTicketResp = await fetchJson(`${baseUrl}/api/auth/ticket`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ scope: 'file', jobId: pausedJobId })
    });
    assert.equal(fileTicketResp.response.status, 200, 'Expected file ticket issuance');
    const fileTicket = String(fileTicketResp.json?.ticket || '');
    assert.ok(fileTicket, 'Expected non-empty file ticket');

    const firstFile = await fetch(`${baseUrl}/api/download/${pausedJobId}/file?ticket=${encodeURIComponent(fileTicket)}`);
    assert.equal(firstFile.status, 404, 'Expected file endpoint to pass auth and fail as not ready');

    const secondFile = await fetch(`${baseUrl}/api/download/${pausedJobId}/file?ticket=${encodeURIComponent(fileTicket)}`);
    assert.equal(secondFile.status, 401, 'Expected consumed file ticket to be rejected');
  }

  // 4) Queue behavior with MAX_CONCURRENT_DOWNLOADS=1.
  {
    const first = await fetchJson(`${baseUrl}/api/download`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ url: 'http://1.1.1.1/slow', options: { autoStart: true } })
    });
    assert.equal(first.response.status, 200, 'Expected first queued job create success');

    const second = await fetchJson(`${baseUrl}/api/download`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ url: 'http://9.9.9.9/fast', options: { autoStart: true } })
    });
    assert.equal(second.response.status, 200, 'Expected second queued job create success');

    let sawQueued = false;
    const started = Date.now();
    while (Date.now() - started < 6000) {
      const health = await fetchJson(`${baseUrl}/health`);
      const activeJobs = Number(health.json?.activeJobs ?? 0);
      const queuedJobs = Number(health.json?.queuedJobs ?? 0);
      if (activeJobs === 1 && queuedJobs >= 1) {
        sawQueued = true;
        break;
      }
      await sleep(200);
    }
    assert.ok(sawQueued, 'Expected queue to hold at least one job while one is active');
  }

  console.log('Security integration tests passed');
} catch (error) {
  console.error('Security integration tests failed');
  console.error(error);
  console.error(serverLogs);
  process.exitCode = 1;
} finally {
  await stopServer();
}
