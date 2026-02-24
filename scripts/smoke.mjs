import { spawn } from 'node:child_process';
import fs from 'node:fs';

const serverPath = new URL('../dist/server.cjs', import.meta.url);
if (!fs.existsSync(serverPath)) {
  console.error('Missing dist/server.cjs. Run npm run build first.');
  process.exit(1);
}

const port = process.env.SMOKE_PORT || '4010';
const env = { ...process.env, PORT: port };

const server = spawn('node', ['dist/server.cjs'], { stdio: 'inherit', env });

const waitFor = async (url, timeoutMs = 20000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // wait
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
};

const run = async () => {
  const base = `http://localhost:${port}`;
  const ok = await waitFor(`${base}/health`);
  if (!ok) {
    console.error('Health check failed');
    server.kill('SIGTERM');
    process.exit(1);
  }

  const formats = await fetch(`${base}/api/formats`);
  if (!formats.ok) {
    console.error('Formats endpoint failed');
    server.kill('SIGTERM');
    process.exit(1);
  }

  console.log('Smoke test passed');
  server.kill('SIGTERM');
};

run().catch((err) => {
  console.error(err);
  server.kill('SIGTERM');
  process.exit(1);
});
