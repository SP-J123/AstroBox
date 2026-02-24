import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import dns from 'node:dns/promises';
import readline from 'node:readline';
import { initDb } from './db';

const app = express();
app.disable('x-powered-by');

const parseEnvInt = (name: string, fallback: number, min: number, max: number) => {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const parseEnvFloat = (name: string, fallback: number, min: number, max: number) => {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const parseEnvBool = (name: string, fallback: boolean) => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const PORT = parseEnvInt('PORT', 3536, 1, 65535);
const HOST = process.env.HOST || '127.0.0.1';

const publicDir = path.resolve(process.cwd(), 'dist/public');

const downloadBase = path.resolve(process.env.DOWNLOAD_PATH || path.join(process.cwd(), 'downloads'));
const configDir = path.resolve(process.env.CONFIG_PATH || path.join(process.cwd(), 'config'));
const cookiePath = process.env.COOKIE_PATH || path.join(configDir, 'cookies.txt');
const dbPath = process.env.DATABASE_PATH || path.join(configDir, 'history.json');
const maxConcurrent = parseEnvInt('MAX_CONCURRENT_DOWNLOADS', 3, 1, 12);
const defaultFormat = process.env.DEFAULT_FORMAT || 'bestvideo*+bestaudio/best';
const defaultOutputTemplate = process.env.OUTPUT_TEMPLATE || '%(title)s.%(ext)s';
const defaultChapterTemplate = process.env.CHAPTER_TEMPLATE || '%(title)s - %(section_number)02d - %(section_title)s.%(ext)s';
const cpuCores = Math.max(1, os.cpus().length);
const minFreeMemMb = parseEnvInt('MIN_FREE_MEM_MB', 384, 64, 64 * 1024);
const memPerResourceUnitMb = parseEnvInt('MEM_PER_RESOURCE_UNIT_MB', 320, 64, 16 * 1024);
const cpuUtilizationTarget = parseEnvFloat('CPU_UTILIZATION_TARGET', 0.75, 0.3, 1);
const maxResourceUnits = parseEnvInt('MAX_RESOURCE_UNITS', Math.max(2, cpuCores * 2), 1, 64);
const maxFfmpegThreads = parseEnvInt('MAX_FFMPEG_THREADS', Math.max(1, Math.min(4, cpuCores)), 1, 16);
const queueRetryMs = parseEnvInt('QUEUE_RETRY_MS', 2500, 500, 60_000);
const silentMode = parseEnvBool('SILENT_MODE', true);
const analyzeTimeoutMs = parseEnvInt('ANALYZE_TIMEOUT_MS', 30_000, 5_000, 120_000);
const analyzeConcurrency = parseEnvInt('ANALYZE_CONCURRENCY', 4, 1, 10);
const jobRetentionMs = parseEnvInt('JOB_RETENTION_MS', 6 * 60 * 60 * 1000, 60_000, 24 * 60 * 60 * 1000);
let writeApiToken = process.env.API_TOKEN?.trim() || '';
const requireApiToken = parseEnvBool('REQUIRE_API_TOKEN', true);
const ticketTtlMs = parseEnvInt('AUTH_TICKET_TTL_MS', 120_000, 15_000, 30 * 60 * 1000);
const dnsCacheTtlMs = parseEnvInt('DNS_CACHE_TTL_MS', 5 * 60 * 1000, 15_000, 24 * 60 * 60 * 1000);
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && requireApiToken && !writeApiToken) {
  writeApiToken = randomUUID();
  console.warn('\n================================================================');
  console.warn('⚠️  SECURITY NOTICE: No API_TOKEN was found in your environment!');
  console.warn('⚠️  AstroBox has auto-generated a secure token for this session.');
  console.warn(`⚠️  Your temporary API_TOKEN is: ${writeApiToken}`);
  console.warn('⚠️  Please set the API_TOKEN environment variable permanently.');
  console.warn('================================================================\n');
}

fs.mkdirSync(downloadBase, { recursive: true });
fs.mkdirSync(configDir, { recursive: true });
const downloadBaseReal = fs.realpathSync(downloadBase);

const db = initDb(dbPath);
let shuttingDown = false;

app.use(express.json({ limit: '1mb' }));
if (corsOrigins.length > 0) {
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Not allowed by CORS'));
      }
    })
  );
}
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", 'https:', 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
        connectSrc: ["'self'"]
      }
    }
  })
);
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false
  })
);

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

const analyzeSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(40)
});

const downloadSchema = z.object({
  url: z.string().url(),
  format: z
    .string()
    .max(200)
    .regex(new RegExp('^[0-9A-Za-z_+\\-\\[\\]\\*\\/=.,:<>=|]+$'), 'Invalid format string')
    .optional(),
  options: z
    .object({
      container: z.enum(['MP4', 'WebM', 'MKV', 'MOV']).optional(),
      resolutionCap: z.enum(['Auto', '2160p', '1440p', '1080p', '720p']).optional(),
      audioFormat: z.enum(['Original', 'MP3', 'AAC', 'FLAC', 'OPUS']).optional(),
      quality: z.enum(['best', '2160', '1440', '1080', '720', 'audio']).optional(),
      format: z.enum(['any', 'mp4', 'webm', 'mkv', 'mov', 'mp3', 'm4a', 'aac', 'opus', 'flac']).optional(),
      autoStart: z.boolean().optional(),
      downloadFolder: z
        .string()
        .max(120)
        .regex(/^[^:\r\n]*$/, 'Invalid folder')
        .refine((value) => !value.includes('..'), 'Invalid folder')
        .optional(),
      customNamePrefix: z.string().max(80).regex(/^[^\r\n]*$/, 'Invalid name prefix').optional(),
      itemsLimit: z.number().int().min(0).max(500).optional(),
      chapterTemplate: z.string().max(300).regex(/^[^\r\n]*$/, 'Invalid template').optional(),
      audioQuality: z.number().min(0).max(10).optional(),
      sponsorBlock: z.boolean().optional(),
      subtitles: z.boolean().optional(),
      splitChapters: z.boolean().optional(),
      embedMetadata: z.boolean().optional(),
      embedThumbnail: z.boolean().optional(),
      proxy: z.string().max(200).regex(/^[^\r\n]*$/, 'Invalid proxy value').optional(),
      rateLimit: z.union([z.literal(''), z.string().max(20).regex(/^[0-9.]+[KMG]?$/i, 'Invalid rate limit')]).optional(),
      fps60: z.boolean().optional(),
      hdr: z.boolean().optional(),
      userAgent: z.string().max(200).regex(/^[^\r\n]*$/, 'Invalid user agent').optional(),
      referrer: z.union([z.literal(''), z.string().url().max(200)]).optional()
    })
    .optional()
});

const configSchema = z.object({
  proxy: z.string().max(200).regex(/^[^\r\n]*$/, 'Invalid proxy value').optional(),
  rateLimit: z.union([z.literal(''), z.string().max(20).regex(/^[0-9.]+[KMG]?$/i, 'Invalid rate limit')]).optional(),
  defaultFormat: z
    .string()
    .max(200)
    .regex(new RegExp('^[0-9A-Za-z_+\\-\\[\\]\\*\\/=.,:<>=|]+$'), 'Invalid format string')
    .optional()
});

const ticketSchema = z.object({
  scope: z.enum(['sse', 'file']),
  jobId: z.string().uuid()
});

type JobStatus = 'paused' | 'queued' | 'downloading' | 'processing' | 'completed' | 'error' | 'cancelled';

type DownloadOptions = {
  container?: string;
  resolutionCap?: string;
  fps60?: boolean;
  hdr?: boolean;
  audioFormat?: string;
  quality?: 'best' | '2160' | '1440' | '1080' | '720' | 'audio';
  format?: 'any' | 'mp4' | 'webm' | 'mkv' | 'mov' | 'mp3' | 'm4a' | 'aac' | 'opus' | 'flac';
  autoStart?: boolean;
  downloadFolder?: string;
  customNamePrefix?: string;
  itemsLimit?: number;
  chapterTemplate?: string;
  audioQuality?: number;
  sponsorBlock?: boolean;
  subtitles?: boolean;
  splitChapters?: boolean;
  embedMetadata?: boolean;
  embedThumbnail?: boolean;
  proxy?: string;
  rateLimit?: string;
  userAgent?: string;
  referrer?: string;
};

type Job = {
  id: string;
  url: string;
  title: string;
  status: JobStatus;
  progress: number;
  speed: string;
  eta: string;
  size: string;
  format: string;
  logs: string[];
  speedHistory: number[];
  startedAt: string;
  finishedAt?: string;
  lastPersistAt: number;
  filePath?: string;
  process?: ReturnType<typeof spawn>;
  emitter: EventEmitter;
  options?: DownloadOptions;
  attempts: number;
  resourceUnits: number;
};

type ExtractedStream = {
  id: string;
  type: 'video' | 'audio';
  label: string;
  codec: string;
  size: number;
  quality: 'premium' | 'balanced' | 'economy';
  ext: string;
  resolution?: string;
  width?: number;
  height?: number;
  fps?: number;
  hdr?: boolean;
  tbr?: number;
  vbr?: number;
  abr?: number;
  channels?: number;
  asr?: number;
};

const jobs = new Map<string, Job>();
const queue: string[] = [];
const active = new Set<string>();
const accessTickets = new Map<string, { scope: 'sse' | 'file'; jobId: string; expiresAt: number }>();
const jobCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
let activeResourceUnits = 0;
let queueRetryTimer: ReturnType<typeof setTimeout> | null = null;

const persistJob = (job: Job, force = false) => {
  const now = Date.now();
  if (!force && now - job.lastPersistAt < 2000) return;
  job.lastPersistAt = now;
  db.saveJob({
    id: job.id,
    url: job.url,
    title: job.title,
    status: job.status,
    progress: job.progress,
    speed: job.speed,
    eta: job.eta,
    size: job.size,
    format: job.format,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    filePath: job.filePath,
    speedHistory: job.speedHistory
  });
};

const notify = (job: Job, payload: Record<string, unknown>) => {
  job.emitter.emit('update', payload);
};

const knownUnsafeHostSuffixes = ['.local', '.internal', '.localhost', '.localdomain'];
const dnsAllowCache = new Map<string, { allowed: boolean; expiresAt: number }>();

const isPrivateIpv4 = (address: string) => {
  const parts = address.split('.').map((item) => Number(item));
  if (parts.length !== 4 || parts.some((item) => Number.isNaN(item) || item < 0 || item > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  return false;
};

const isPrivateIpv6 = (address: string) => {
  const normalized = address.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('fe80:')) return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    return isPrivateIpv4(mapped);
  }
  return false;
};

const isPrivateIp = (address: string) => {
  const ipType = net.isIP(address);
  if (ipType === 4) return isPrivateIpv4(address);
  if (ipType === 6) return isPrivateIpv6(address);
  return false;
};

const assertSafeRemoteUrl = async (rawUrl: string) => {
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP/HTTPS URLs are allowed.');
  }

  const hostname = url.hostname.toLowerCase();
  if (!hostname) throw new Error('Invalid URL host.');
  if (hostname === 'localhost' || knownUnsafeHostSuffixes.some((suffix) => hostname.endsWith(suffix))) {
    throw new Error('Local or internal hostnames are not allowed.');
  }

  if (net.isIP(hostname) && isPrivateIp(hostname)) {
    throw new Error('Private or loopback IP addresses are not allowed.');
  }

  const cachedResult = dnsAllowCache.get(hostname);
  if (cachedResult && cachedResult.expiresAt > Date.now()) {
    if (!cachedResult.allowed) {
      throw new Error('Host resolution is blocked for private/internal address space.');
    }
    return;
  }
  if (cachedResult) {
    dnsAllowCache.delete(hostname);
  }

  let resolved: Array<{ address: string; family: number }>;
  try {
    resolved = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error('Unable to resolve remote host.');
  }

  if (!resolved.length) {
    dnsAllowCache.set(hostname, { allowed: false, expiresAt: Date.now() + dnsCacheTtlMs });
    throw new Error('Unable to resolve remote host.');
  }

  const safe = resolved.every((entry) => !isPrivateIp(entry.address));
  dnsAllowCache.set(hostname, { allowed: safe, expiresAt: Date.now() + dnsCacheTtlMs });
  if (!safe) {
    throw new Error('Host resolves to private/internal address space.');
  }
};

const safeTokenCompare = (provided: string, expected: string) => {
  if (!provided || !expected) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
};

const getHeaderAuthToken = (req: express.Request) => {
  const headerToken = req.get('x-api-token');
  if (headerToken && headerToken.trim()) return headerToken.trim();
  return '';
};

const getAccessTicket = (req: express.Request) => {
  const ticket = typeof req.query.ticket === 'string' ? req.query.ticket : '';
  return ticket.trim();
};

const pruneAccessTickets = () => {
  const now = Date.now();
  for (const [ticket, payload] of accessTickets.entries()) {
    if (payload.expiresAt <= now) accessTickets.delete(ticket);
  }
};

const verifyAccessTicket = (req: express.Request, ticket: string) => {
  pruneAccessTickets();
  const entry = accessTickets.get(ticket);
  if (!entry) return false;
  if (entry.expiresAt <= Date.now()) {
    accessTickets.delete(ticket);
    return false;
  }

  const pathName = req.path.toLowerCase();
  const requestedJobId = String(req.params.id || '');
  if (!requestedJobId || requestedJobId !== entry.jobId) return false;

  if (entry.scope === 'sse' && pathName.endsWith('/progress')) return true;
  if (entry.scope === 'file' && pathName.endsWith('/file')) {
    accessTickets.delete(ticket);
    return true;
  }
  return false;
};

const requireWriteAccess: express.RequestHandler = (req, res, next) => {
  if (!writeApiToken) return next();
  const token = getHeaderAuthToken(req);
  if (token && safeTokenCompare(token, writeApiToken)) return next();
  const ticket = getAccessTicket(req);
  if (ticket && verifyAccessTicket(req, ticket)) return next();
  return res.status(401).json({ error: 'Unauthorized.' });
};

const enqueueJob = (job: Job) => {
  const timer = jobCleanupTimers.get(job.id);
  if (timer) {
    clearTimeout(timer);
    jobCleanupTimers.delete(job.id);
  }
  if (job.status !== 'queued') return;
  if (active.has(job.id)) return;
  if (queue.includes(job.id)) return;
  queue.push(job.id);
  processQueue();
};

const scheduleTerminalCleanup = (jobId: string) => {
  const existing = jobCleanupTimers.get(jobId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    jobs.delete(jobId);
    jobCleanupTimers.delete(jobId);
  }, jobRetentionMs);
  jobCleanupTimers.set(jobId, timer);
};

const dequeueJob = (jobId: string) => {
  let idx = queue.indexOf(jobId);
  while (idx !== -1) {
    queue.splice(idx, 1);
    idx = queue.indexOf(jobId);
  }
};

const processQueue = () => {
  while (active.size < maxConcurrent && queue.length > 0) {
    const budget = getRuntimeBudget();
    if (budget.dynamicUnitBudget <= 0) {
      scheduleQueueRetry();
      break;
    }
    const id = queue.shift();
    if (!id) break;
    const job = jobs.get(id);
    if (!job) continue;
    if (job.status !== 'queued') continue;
    const requiredUnits = estimateJobResourceUnits(job.options);
    if (activeResourceUnits + requiredUnits > budget.dynamicUnitBudget) {
      queue.unshift(id);
      scheduleQueueRetry();
      break;
    }
    runJob(job, requiredUnits);
  }
};

const parseProgress = (line: string) => {
  const match = line.match(/\[download\]\s+(\d{1,3}(?:\.\d+)?)%.*?(?:of\s+([^\s]+))?.*?at\s+([^\s]+)\s+ETA\s+([^\s]+)/i);
  if (!match) return null;
  const percent = Number(match[1]);
  const size = match[2] ?? '—';
  const speed = match[3];
  const eta = match[4];
  return { percent, speed, eta, size };
};

const resolveTargetDir = (folder: string | undefined) => {
  const raw = (folder || '').trim();
  if (!raw) return downloadBase;
  const normalized = raw.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const resolved = path.resolve(downloadBase, normalized);
  const rel = path.relative(downloadBase, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return downloadBase;
  }
  return resolved;
};

const sanitizePrefix = (value: string | undefined) => {
  const raw = (value || '').trim();
  if (!raw) return '';
  return raw.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim();
};

const sanitizeTemplate = (value: string | undefined, fallback: string) => {
  const raw = (value || '').trim();
  if (!raw) return fallback;
  if (raw.includes('..') || raw.includes(':') || /[\\/]/.test(raw)) return fallback;
  return raw;
};

const isPathInsideDownloadBase = (candidatePath: string) => {
  try {
    const candidateReal = fs.realpathSync(candidatePath);
    const rel = path.relative(downloadBaseReal, candidateReal);
    return !rel.startsWith('..') && !path.isAbsolute(rel);
  } catch {
    return false;
  }
};

const ensureSafeTargetDir = (candidateDir: string) => {
  try {
    fs.mkdirSync(candidateDir, { recursive: true });
  } catch {
    return downloadBase;
  }
  if (isPathInsideDownloadBase(candidateDir)) return candidateDir;
  return downloadBase;
};

const estimateJobResourceUnits = (options?: DownloadOptions) => {
  let units = 1;
  const quality = options?.quality || 'best';
  if (quality === '2160' || quality === '1440') units += 2;
  else if (quality === '1080' || quality === '720') units += 1;
  if (options?.hdr) units += 1;
  if (options?.splitChapters) units += 1;
  if (typeof options?.itemsLimit === 'number' && options.itemsLimit > 20) units += 1;
  return Math.min(6, Math.max(1, units));
};

const getRuntimeBudget = () => {
  const freeMemMb = Math.floor(os.freemem() / (1024 * 1024));
  const totalMemMb = Math.floor(os.totalmem() / (1024 * 1024));
  const cpuBudgetUnits = Math.max(1, Math.floor(cpuCores * cpuUtilizationTarget * 2));
  const memBudgetUnits = Math.max(0, Math.floor((freeMemMb - minFreeMemMb) / Math.max(1, memPerResourceUnitMb)));
  const dynamicUnitBudget = Math.max(0, Math.min(maxResourceUnits, cpuBudgetUnits, memBudgetUnits > 0 ? memBudgetUnits : 0));
  return {
    cpuCores,
    freeMemMb,
    totalMemMb,
    cpuBudgetUnits,
    memBudgetUnits,
    dynamicUnitBudget
  };
};

const pickFfmpegThreads = () => {
  const activeCount = Math.max(1, active.size + 1);
  const cpuBudget = Math.max(1, Math.floor(cpuCores * cpuUtilizationTarget));
  return Math.max(1, Math.min(maxFfmpegThreads, Math.floor(cpuBudget / activeCount) || 1));
};

const scheduleQueueRetry = () => {
  if (queueRetryTimer) return;
  queueRetryTimer = setTimeout(() => {
    queueRetryTimer = null;
    processQueue();
  }, queueRetryMs);
};

async function allSettledWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
) {
  const results: Array<PromiseSettledResult<R>> = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) break;
      try {
        const value = await worker(items[index], index);
        results[index] = { status: 'fulfilled', value };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  });

  await Promise.all(runners);
  return results;
}

const extractFilePathFromLog = (line: string) => {
  const patterns = [
    /^\[download\]\s+Destination:\s+(.+)$/i,
    /^\[ExtractAudio\]\s+Destination:\s+(.+)$/i,
    /^\[Merger\]\s+Merging formats into\s+"(.+)"$/i,
    /^\[VideoRemuxer\]\s+Remuxing video from .+ to "(.+)"$/i
  ];
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
};

const markJobFailure = (job: Job, message: string) => {
  if (job.status === 'cancelled') return;
  job.attempts += 1;
  if (job.attempts <= 3) {
    const delay = 2000 * 2 ** (job.attempts - 1);
    job.status = 'queued';
    job.progress = 0;
    notify(job, { status: job.status, log: `[retry] Attempt ${job.attempts} scheduled in ${delay / 1000}s.` });
    if (message) notify(job, { log: message });
    persistJob(job, true);
    setTimeout(() => enqueueJob(job), delay);
    return;
  }

  job.status = 'error';
  job.finishedAt = new Date().toISOString();
  notify(job, { status: job.status, log: message || '[error] Download failed.' });
  persistJob(job, true);
  scheduleTerminalCleanup(job.id);
};

const runJob = (job: Job, reservedUnits: number) => {
  if (job.status !== 'queued') return;

  const args = ['--newline'];
  if (silentMode) args.push('--no-warnings');

  if (typeof job.options?.itemsLimit === 'number' && job.options.itemsLimit > 0) {
    args.push('--playlist-end', String(job.options.itemsLimit));
  } else {
    args.push('--no-playlist');
  }

  if (fs.existsSync(cookiePath)) {
    args.push('--cookies', cookiePath);
  }

  if (job.options?.proxy) args.push('--proxy', job.options.proxy);
  if (job.options?.rateLimit) args.push('--rate-limit', job.options.rateLimit);
  if (job.options?.userAgent) args.push('--user-agent', job.options.userAgent);
  if (job.options?.referrer) args.push('--referer', job.options.referrer);
  const ffmpegThreads = pickFfmpegThreads();
  args.push('--postprocessor-args', `ffmpeg:-threads ${ffmpegThreads} -loglevel warning`);

  const requestedDir = resolveTargetDir(job.options?.downloadFolder);
  const targetDir = ensureSafeTargetDir(requestedDir);
  const safePrefix = sanitizePrefix(job.options?.customNamePrefix);
  const baseTemplate = sanitizeTemplate(job.options?.chapterTemplate, defaultChapterTemplate);
  const fileTemplate = safePrefix ? `${safePrefix} - ${defaultOutputTemplate}` : defaultOutputTemplate;
  const outputTemplate = path.join(targetDir, fileTemplate);
  args.push('-o', outputTemplate);

  let formatArg = job.format || defaultFormat;
  if (job.options?.quality) {
    switch (job.options.quality) {
      case 'audio':
        formatArg = 'bestaudio/best';
        break;
      case '2160':
      case '1440':
      case '1080':
      case '720':
        formatArg = `bestvideo[height<=${job.options.quality}]+bestaudio/best`;
        break;
      default:
        break;
    }
  }
  if (job.options?.resolutionCap) {
    const match = job.options.resolutionCap.match(/(\d+)/);
    if (match) {
      formatArg = `bestvideo[height<=${match[1]}]+bestaudio/best`;
    }
  }
  args.push('-f', formatArg);

  const sortHints: string[] = [];
  if (job.options?.hdr) sortHints.push('hdr');
  if (job.options?.fps60) sortHints.push('fps');
  if (sortHints.length > 0) args.push('-S', sortHints.join(','));

  if (job.options?.container) args.push('--merge-output-format', job.options.container.toLowerCase());
  if (job.options?.format && ['mp4', 'webm', 'mkv', 'mov'].includes(job.options.format)) {
    args.push('--merge-output-format', job.options.format);
  }
  if (job.options?.format && ['mp3', 'm4a', 'aac', 'opus', 'flac'].includes(job.options.format)) {
    args.push('--extract-audio', '--audio-format', job.options.format);
  }
  if (job.options?.audioFormat && job.options.audioFormat.toLowerCase() !== 'original') {
    args.push('--extract-audio', '--audio-format', job.options.audioFormat.toLowerCase());
  }
  if (typeof job.options?.audioQuality === 'number') {
    args.push('--audio-quality', String(job.options.audioQuality));
  }
  if (job.options?.sponsorBlock) args.push('--sponsorblock-remove', 'all');
  if (job.options?.subtitles) args.push('--write-subs', '--sub-langs', 'all', '--embed-subs');
  if (job.options?.splitChapters) {
    args.push('--split-chapters');
    const chapterTemplate = safePrefix ? `${safePrefix} - ${baseTemplate}` : baseTemplate;
    args.push('-o', `chapter:${path.join(targetDir, chapterTemplate)}`);
  }
  if (job.options?.embedMetadata) args.push('--embed-metadata');
  if (job.options?.embedThumbnail) args.push('--embed-thumbnail');

  args.push(job.url);

  job.status = 'downloading';
  job.resourceUnits = reservedUnits;
  job.process = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  active.add(job.id);
  activeResourceUnits += reservedUnits;
  notify(job, { status: job.status, resourceUnits: reservedUnits, log: `[resource] Reserved ${reservedUnits} units.` });
  persistJob(job);

  let finalized = false;
  const finalize = (callback: () => void) => {
    if (finalized) return;
    finalized = true;
    callback();
    processQueue();
  };

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    job.logs.push(trimmed);
    if (job.logs.length > 120) job.logs.shift();
    db.appendLog(job.id, trimmed);

    const extractedPath = extractFilePathFromLog(trimmed);
    if (extractedPath) {
      const filePath = extractedPath.replace(/^"+|"+$/g, '');
      job.filePath = filePath;
      const base = path.basename(filePath);
      job.title = base.replace(/\.[^/.]+$/, '');
      notify(job, { filePath: job.filePath, title: job.title, log: trimmed });
      persistJob(job, true);
    }

    const progress = parseProgress(trimmed);
    if (progress) {
      job.progress = progress.percent;
      job.speed = progress.speed;
      job.eta = progress.eta;
      job.size = progress.size;
      const speedValue = Number(progress.speed.replace(/[^0-9.]/g, ''));
      if (!Number.isNaN(speedValue)) {
        job.speedHistory.push(speedValue);
        if (job.speedHistory.length > 20) job.speedHistory.shift();
      }
      notify(job, {
        progress: job.progress,
        speed: job.speed,
        eta: job.eta,
        size: job.size,
        speedHistory: job.speedHistory,
        log: trimmed
      });
      persistJob(job);
      return;
    }

    notify(job, { log: trimmed });
  };

  const stdoutRl = job.process.stdout ? readline.createInterface({ input: job.process.stdout }) : null;
  const stderrRl = job.process.stderr ? readline.createInterface({ input: job.process.stderr }) : null;

  stdoutRl?.on('line', handleLine);
  stderrRl?.on('line', handleLine);

  job.process.on('error', (error) => {
    finalize(() => {
      active.delete(job.id);
      activeResourceUnits = Math.max(0, activeResourceUnits - reservedUnits);
      stdoutRl?.close();
      stderrRl?.close();
      markJobFailure(job, `[error] Failed to start yt-dlp: ${error.message}`);
    });
  });

  job.process.on('close', (code) => {
    finalize(() => {
      active.delete(job.id);
      activeResourceUnits = Math.max(0, activeResourceUnits - reservedUnits);
      stdoutRl?.close();
      stderrRl?.close();

      if (code === 0) {
        job.status = 'completed';
        job.progress = 100;
        job.eta = '00:00';
        job.finishedAt = new Date().toISOString();
        notify(job, { status: job.status, progress: 100, filePath: job.filePath, log: '[done] Download completed.' });
        persistJob(job, true);
        scheduleTerminalCleanup(job.id);
      } else if (job.status !== 'cancelled') {
        markJobFailure(job, '[error] Download failed.');
      }
    });
  });
};

app.post('/api/analyze', requireWriteAccess, async (req, res) => {
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid URL payload.' });
  }

  try {
    await Promise.all(parsed.data.urls.map((url) => assertSafeRemoteUrl(url)));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid remote URL.';
    return res.status(400).json({ error: message });
  }

  try {
    const settled = await allSettledWithConcurrency(parsed.data.urls, analyzeConcurrency, (url) => runYtDlpJson(url));
    const items: Array<Record<string, unknown>> = [];
    let firstJson: Record<string, unknown> | null = null;
    let failed = 0;

    settled.forEach((result, index) => {
      const url = parsed.data.urls[index];
      if (result.status === 'fulfilled') {
        if (!firstJson) firstJson = result.value;
        items.push(normalizeItem(result.value, url));
      } else {
        failed += 1;
      }
    });

    if (items.length === 0) {
      const firstFailure = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected');
      const message = firstFailure?.reason instanceof Error ? firstFailure.reason.message : 'Analyze failed.';
      return res.status(500).json({ error: message });
    }

    const streams = firstJson ? extractStreams(firstJson) : [];
    res.json({ items, streams, failed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analyze failed.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/download', requireWriteAccess, (req, res) => {
  const parsed = downloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid download request.' });
  }

  assertSafeRemoteUrl(parsed.data.url).then(() => {
    const id = randomUUID();
    const startedAt = new Date().toISOString();
    const initialStatus: JobStatus = parsed.data.options?.autoStart === false ? 'paused' : 'queued';
    const job: Job = {
      id,
      url: parsed.data.url,
      title: parsed.data.url,
      status: initialStatus,
      progress: 0,
      speed: '—',
      eta: '—',
      size: '—',
      format: parsed.data.format || defaultFormat,
      logs: [initialStatus === 'paused' ? '[pause] Job created. Start manually.' : '[queue] Job queued.'],
      speedHistory: [],
      emitter: new EventEmitter(),
      options: parsed.data.options,
      attempts: 0,
      resourceUnits: 0,
      startedAt,
      lastPersistAt: 0
    };

    jobs.set(id, job);
    persistJob(job, true);
    if (job.status === 'queued') {
      enqueueJob(job);
    }

    const budget = getRuntimeBudget();
    res.json({
      id,
      status: job.status,
      resourceUnits: estimateJobResourceUnits(job.options),
      resourceBudgetUnits: budget.dynamicUnitBudget
    });
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Invalid remote URL.';
    res.status(400).json({ error: message });
  });
});

app.get('/api/download/:id/progress', requireWriteAccess, (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).end();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  const send = (payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send({
    status: job.status,
    progress: job.progress,
    speed: job.speed,
    eta: job.eta,
    size: job.size,
    format: job.format,
    speedHistory: job.speedHistory,
    filePath: job.filePath,
    resourceUnits: job.resourceUnits
  });

  const handler = (payload: Record<string, unknown>) => send(payload);
  job.emitter.on('update', handler);

  const ping = setInterval(() => res.write('event: ping\n\n'), 15000);

  req.on('close', () => {
    clearInterval(ping);
    job.emitter.off('update', handler);
    res.end();
  });
});

app.get('/api/download/:id/file', requireWriteAccess, (req, res) => {
  const memoryJob = jobs.get(req.params.id);
  const historyJob = db.getJob(req.params.id);
  const status = memoryJob?.status ?? historyJob?.status;
  const filePath = memoryJob?.filePath ?? historyJob?.filePath;

  if (status !== 'completed' || !filePath) {
    return res.status(404).json({ error: 'File not ready.' });
  }

  const candidatePath = path.resolve(filePath);
  const logicalRel = path.relative(downloadBase, candidatePath);
  if (logicalRel.startsWith('..') || path.isAbsolute(logicalRel)) {
    return res.status(400).json({ error: 'Invalid file path.' });
  }

  let resolvedPath = '';
  try {
    resolvedPath = fs.realpathSync(candidatePath);
  } catch {
    return res.status(404).json({ error: 'File not found on disk.' });
  }
  const rel = path.relative(downloadBaseReal, resolvedPath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return res.status(400).json({ error: 'Invalid file path.' });
  }

  res.download(resolvedPath);
});

app.delete('/api/download/:id', requireWriteAccess, (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  dequeueJob(job.id);
  if (job.process && !job.process.killed) {
    job.process.kill('SIGTERM');
  }
  job.status = 'cancelled';
  job.finishedAt = new Date().toISOString();
  notify(job, { status: job.status, log: '[cancel] Job cancelled.' });
  persistJob(job, true);
  scheduleTerminalCleanup(job.id);
  processQueue();
  res.json({ ok: true });
});

app.post('/api/download/:id/start', requireWriteAccess, (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  if (job.status === 'completed' || job.status === 'downloading' || job.status === 'processing') {
    return res.json({ ok: true, status: job.status });
  }
  if (job.status === 'cancelled' || job.status === 'error') {
    return res.status(400).json({ error: 'Job cannot be started.', status: job.status });
  }

  job.status = 'queued';
  notify(job, { status: job.status, log: '[queue] Job started.' });
  persistJob(job, true);
  enqueueJob(job);
  res.json({ ok: true, status: job.status });
});

app.post('/api/auth/ticket', requireWriteAccess, (req, res) => {
  const parsed = ticketSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid ticket request.' });

  const { scope, jobId } = parsed.data;
  if (scope === 'sse') {
    if (!jobs.has(jobId)) return res.status(404).json({ error: 'Job not found.' });
  } else {
    const hasJob = jobs.has(jobId) || Boolean(db.getJob(jobId));
    if (!hasJob) return res.status(404).json({ error: 'Job not found.' });
  }

  const ticket = randomUUID();
  const expiresAt = Date.now() + ticketTtlMs;
  accessTickets.set(ticket, { scope, jobId, expiresAt });
  pruneAccessTickets();
  res.json({ ticket, expiresAt });
});

app.get('/api/formats', (_req, res) => {
  res.json({
    presets: [
      { id: 'archival', title: 'Archival', description: 'Maximum fidelity, lossless audio', format: 'bestvideo*+bestaudio/best' },
      { id: 'mobile', title: 'Mobile', description: '1080p cap, size optimized', format: 'bestvideo[height<=1080]+bestaudio' },
      { id: 'audio', title: 'Audio Only', description: 'Extract best audio stream', format: 'bestaudio/best' },
      { id: 'balanced', title: 'Balanced', description: '1440p cap, smart quality', format: 'bestvideo[height<=1440]+bestaudio' }
    ]
  });
});

app.get('/api/history', requireWriteAccess, (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const limit = typeof req.query.limit === 'string' ? Math.min(Number(req.query.limit) || 100, 200) : 100;
  const items = db.listHistory(query, status, limit);
  res.json({ items });
});

app.get('/api/history/:id', requireWriteAccess, (req, res) => {
  const id = req.params.id;
  const item = db.getJob(id);
  if (!item) return res.status(404).json({ error: 'Not found.' });
  const logs = db.getLogs(id, 200);
  res.json({ item, logs });
});

app.post('/api/config', requireWriteAccess, (req, res) => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid config payload.' });

  const configPath = path.join(configDir, 'settings.json');
  const backupPath = path.join(configDir, `settings.backup.${Date.now()}.json`);

  if (fs.existsSync(configPath)) {
    fs.copyFileSync(configPath, backupPath);
  }

  fs.writeFileSync(configPath, JSON.stringify(parsed.data, null, 2));
  res.json({ ok: true });
});

app.get('/health', (_req, res) => {
  const budget = getRuntimeBudget();
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    activeJobs: active.size,
    queuedJobs: queue.length,
    activeResourceUnits,
    resourceBudgetUnits: budget.dynamicUnitBudget
  });
});

app.get('/api/system', requireWriteAccess, (_req, res) => {
  const budget = getRuntimeBudget();
  res.json({
    activeJobs: active.size,
    queuedJobs: queue.length,
    activeResourceUnits,
    budget
  });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.get('*', (_req, res) => {
  if (fs.existsSync(path.join(publicDir, 'index.html'))) {
    res.sendFile(path.join(publicDir, 'index.html'));
  } else {
    res.status(200).send('Frontend build not found. Run npm run build.');
  }
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`Resource guard enabled: CPU=${cpuCores} cores, target=${cpuUtilizationTarget}, max units=${maxResourceUnits}`);
  console.log(`Analyze concurrency limit: ${analyzeConcurrency}`);
  if (corsOrigins.length === 0) {
    console.log('CORS disabled. Set CORS_ORIGINS to allow cross-origin requests.');
  }
  if (writeApiToken) {
    console.log(`API write access token is enabled. Ticket TTL=${ticketTtlMs}ms`);
  }
});

const shutdown = (signal: string, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}. Draining server and flushing buffered DB writes...`);

  if (queueRetryTimer) {
    clearTimeout(queueRetryTimer);
    queueRetryTimer = null;
  }
  for (const timer of jobCleanupTimers.values()) clearTimeout(timer);
  jobCleanupTimers.clear();

  for (const job of jobs.values()) {
    if (!job.process || job.process.killed) continue;
    try {
      job.status = 'error';
      job.logs.push(`[error] Server shutdown unexpectedly (${signal}).`);
      persistJob(job, true);
      job.process.kill('SIGTERM');
      const forceKill = setTimeout(() => {
        if (!job.process || job.process.killed) return;
        job.process.kill('SIGKILL');
      }, 1500);
      forceKill.unref();
    } catch {
      // best effort shutdown
    }
  }

  const closeServer = new Promise<void>((resolve) => {
    server.close(() => resolve());
    const forceClose = setTimeout(resolve, 5000);
    forceClose.unref();
  });

  Promise.all([
    closeServer,
    db.flush()
  ])
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown shutdown error.';
      console.error(`Shutdown operation failed: ${message}`);
    })
    .finally(() => process.exit(exitCode));
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
  console.error(`Uncaught exception: ${error.message}`);
  shutdown('uncaughtException', 1);
});
process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  console.error(`Unhandled rejection: ${message}`);
  shutdown('unhandledRejection', 1);
});

async function runYtDlpJson(url: string) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const args = ['-J', '--no-playlist', url];
    const process = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let data = '';
    let error = '';
    let settled = false;
    let forceKillTimer: ReturnType<typeof setTimeout> | null = null;

    const done = (err: Error | null, result?: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (forceKillTimer) {
        clearTimeout(forceKillTimer);
        forceKillTimer = null;
      }
      if (err) {
        reject(err);
        return;
      }
      resolve(result || {});
    };

    const timeout = setTimeout(() => {
      process.kill('SIGTERM');
      forceKillTimer = setTimeout(() => {
        if (!process.killed) process.kill('SIGKILL');
      }, 1500);
      forceKillTimer.unref();
      done(new Error(`Analyze timed out after ${analyzeTimeoutMs}ms`));
    }, analyzeTimeoutMs);

    process.stdout?.on('data', (chunk) => (data += chunk.toString()));
    process.stderr?.on('data', (chunk) => (error += chunk.toString()));
    process.on('error', (spawnError) => {
      done(new Error(`Unable to start yt-dlp: ${spawnError.message}`));
    });
    process.on('close', (code) => {
      if (code === 0 && data) {
        try {
          done(null, JSON.parse(data));
        } catch (parseError) {
          done(parseError as Error);
        }
      } else {
        done(new Error(error || 'yt-dlp failed'));
      }
    });
  });
}

function normalizeItem(json: Record<string, unknown>, fallbackUrl: string) {
  const item = json as Record<string, any>;
  return {
    id: item.id ?? randomUUID(),
    title: item.title ?? 'Untitled',
    uploader: item.uploader ?? item.channel ?? 'Unknown',
    duration: item.duration ?? 0,
    views: item.view_count ?? 0,
    date: item.upload_date ? formatDate(item.upload_date) : '',
    platform: item.extractor_key ?? 'YT-DLP',
    thumbnail: selectThumbnail(item),
    url: item.webpage_url ?? fallbackUrl,
    avatar: item.uploader_avatar ?? item.channel_favicon ?? '',
    badge: item.is_live ? 'Live' : 'Video'
  };
}

function normalizeRemoteUrl(value: unknown) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return trimmed;
}

function selectThumbnail(item: Record<string, any>) {
  const direct = normalizeRemoteUrl(item.thumbnail);
  if (direct) return direct;
  if (!Array.isArray(item.thumbnails)) return '';

  const candidates = item.thumbnails
    .map((thumb: any) => ({
      url: normalizeRemoteUrl(thumb?.url),
      score: Number(thumb?.width || 0) * Number(thumb?.height || 0)
    }))
    .filter((thumb: { url: string; score: number }) => Boolean(thumb.url));

  if (candidates.length === 0) return '';
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].url;
}

function formatDate(date: string) {
  if (!date || date.length !== 8) return date;
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

function extractStreams(json: Record<string, unknown>) {
  const item = json as Record<string, any>;
  const formats = Array.isArray(item.formats) ? (item.formats as Array<Record<string, any>>) : [];
  const streams: ExtractedStream[] = [];

  for (const format of formats) {
    const vcodec = format.vcodec;
    const acodec = format.acodec;
    const hasVideo = vcodec && vcodec !== 'none';
    const hasAudio = acodec && acodec !== 'none';
    if (hasVideo && !hasAudio) {
      const height = format.height ?? 0;
      const width = format.width ?? 0;
      const quality = height >= 2160 ? 'premium' : height >= 1440 ? 'balanced' : 'economy';
      streams.push({
        id: String(format.format_id ?? randomUUID()),
        type: 'video',
        label: format.format_note || (height ? `${height}p` : 'Video'),
        resolution: width && height ? `${width}x${height}` : undefined,
        width: width || undefined,
        height: height || undefined,
        fps: format.fps ?? undefined,
        codec: String(vcodec),
        size: format.filesize ?? format.filesize_approx ?? 0,
        quality,
        ext: format.ext ?? 'mp4',
        hdr: typeof format.dynamic_range === 'string' ? format.dynamic_range.toLowerCase().includes('hdr') : false,
        tbr: format.tbr ?? undefined,
        vbr: format.vbr ?? undefined
      });
      continue;
    }
    if (hasAudio && !hasVideo) {
      streams.push({
        id: String(format.format_id ?? randomUUID()),
        type: 'audio',
        label: format.format_note || (format.asr ? `${format.asr}Hz` : 'Audio'),
        codec: String(acodec),
        size: format.filesize ?? format.filesize_approx ?? 0,
        quality: 'balanced',
        ext: format.ext ?? 'm4a',
        tbr: format.tbr ?? undefined,
        abr: format.abr ?? undefined,
        channels: format.channels ?? undefined,
        asr: format.asr ?? undefined
      });
    }
  }

  return streams.slice(0, 40);
}
