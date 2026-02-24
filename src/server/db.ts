import path from 'node:path';
import fs from 'node:fs';

export type HistoryJob = {
  id: string;
  url: string;
  title: string;
  status: string;
  progress: number;
  speed: string;
  eta: string;
  size: string;
  format: string;
  startedAt: string;
  finishedAt?: string | null;
  filePath?: string | null;
  speedHistory: number[];
};

type DbData = {
  jobs: HistoryJob[];
  logs: Record<string, string[]>;
};

const ensureDir = (filePath: string) => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
};

export const initDb = (dbPath: string) => {
  ensureDir(dbPath);

  let data: DbData = { jobs: [], logs: {} };
  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw) as Partial<DbData>;
        data = {
          jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
          logs: parsed.logs && typeof parsed.logs === 'object' ? parsed.logs : {}
        };
      }
    }
  } catch {
    data = { jobs: [], logs: {} };
  }

  let dirty = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let isFlushing = false;

  const flushNow = async () => {
    if (isFlushing || !dirty) return;
    isFlushing = true;
    try {
      while (dirty) {
        dirty = false;
        const snapshot = JSON.stringify(data, null, 2);
        const tempPath = `${dbPath}.tmp`;
        await fs.promises.writeFile(tempPath, snapshot, 'utf8');
        await fs.promises.rename(tempPath, dbPath);
      }
    } finally {
      isFlushing = false;
    }
  };

  const scheduleFlush = (delayMs = 3000) => {
    dirty = true;
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushNow();
    }, delayMs);
  };

  return {
    saveJob: (job: HistoryJob) => {
      const existingIndex = data.jobs.findIndex((item) => item.id === job.id);
      if (existingIndex >= 0) {
        data.jobs[existingIndex] = { ...data.jobs[existingIndex], ...job };
      } else {
        data.jobs.unshift(job);
      }
      data.jobs = data.jobs.slice(0, 500);

      // Drop logs for jobs that aged out of retained history.
      const validIds = new Set(data.jobs.map((item) => item.id));
      for (const key of Object.keys(data.logs)) {
        if (!validIds.has(key)) delete data.logs[key];
      }

      scheduleFlush();
    },
    appendLog: (jobId: string, line: string) => {
      const list = data.logs[jobId] ?? [];
      list.push(line);
      data.logs[jobId] = list.slice(-500);
      scheduleFlush();
    },
    listHistory: (query?: string, status?: string, limit = 100) => {
      const needle = query?.toLowerCase();
      let items = [...data.jobs];
      if (status) items = items.filter((item) => item.status === status);
      if (needle) items = items.filter((item) => item.title.toLowerCase().includes(needle) || item.url.toLowerCase().includes(needle));
      return items.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit);
    },
    getJob: (jobId: string) => data.jobs.find((item) => item.id === jobId) ?? null,
    getLogs: (jobId: string, limit = 200) => {
      const list = data.logs[jobId] ?? [];
      return list.slice(-limit);
    },
    flush: async () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      dirty = true;
      await flushNow();
    }
  };
};
