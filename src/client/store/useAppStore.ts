import { create, StateCreator } from 'zustand';
import type { DownloadJob, DownloadOptions, MediaItem, Preset, Profile, Stream } from './types';
import { useUiStore } from './useUiStore';

const RECENT_KEY = 'ff-recent-urls';
const OPTIONS_KEY = 'ff-download-options';
const PROFILE_KEY = 'ff-profiles';
const API_TOKEN = (import.meta.env.VITE_API_TOKEN as string | undefined)?.trim() || '';
const videoFormats = new Set<DownloadOptions['format']>(['any', 'mp4', 'webm', 'mkv', 'mov']);
const audioFormats = new Set<DownloadOptions['format']>(['any', 'mp3', 'm4a', 'aac', 'opus', 'flac']);

const eventSources = new Map<string, EventSource>();
const terminalStatuses: DownloadJob['status'][] = ['completed', 'error', 'cancelled'];

const withAuthHeaders = (headers: Record<string, string> = {}) => {
  if (!API_TOKEN) return headers;
  return { ...headers, 'x-api-token': API_TOKEN };
};

const buildApiPath = (path: string) => path;

const closeEventSource = (jobId: string) => {
  const source = eventSources.get(jobId);
  if (!source) return;
  source.close();
  eventSources.delete(jobId);
};

const readErrorMessage = async (response: Response, fallback: string) => {
  try {
    const data = (await response.json()) as { error?: string; msg?: string };
    return data.error || data.msg || fallback;
  } catch {
    return fallback;
  }
};

const requestScopedTicket = async (scope: 'sse' | 'file', jobId: string) => {
  const response = await fetch('/api/auth/ticket', {
    method: 'POST',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ scope, jobId })
  });
  if (!response.ok) {
    const message = await readErrorMessage(response, 'Ticket request failed');
    throw new Error(message);
  }
  const data = (await response.json()) as { ticket?: string };
  if (!data.ticket) throw new Error('Ticket request failed');
  return data.ticket;
};

const defaultOptions: DownloadOptions = {
  container: '',
  resolutionCap: 'Auto',
  fps60: false,
  hdr: false,
  audioFormat: 'Original',
  audioQuality: 7,
  sponsorBlock: false,
  subtitles: false,
  splitChapters: false,
  embedMetadata: false,
  embedThumbnail: false,
  proxy: '',
  rateLimit: '',
  userAgent: '',
  referrer: '',
  quality: 'audio',
  format: 'mp3',
  autoStart: false,
  downloadFolder: '',
  customNamePrefix: '',
  itemsLimit: 0,
  chapterTemplate: '%(title)s - %(section_number)02d - %(section_title)s.%(ext)s',
  bypassResources: false
};

const getId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`);

const loadRecent = (): MediaItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MediaItem[];
  } catch {
    return [];
  }
};

const saveRecent = (items: MediaItem[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 8)));
};

const loadOptions = (): DownloadOptions => {
  if (typeof window === 'undefined') return defaultOptions;
  try {
    const raw = localStorage.getItem(OPTIONS_KEY);
    if (!raw) return defaultOptions;
    const parsed = JSON.parse(raw) as Partial<DownloadOptions>;
    return { ...defaultOptions, ...parsed };
  } catch {
    return defaultOptions;
  }
};

const saveOptions = (options: DownloadOptions) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
};

const loadProfiles = (): Profile[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Profile[];
  } catch {
    return [];
  }
};

const saveProfiles = (profiles: Profile[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
};

const splitUrls = (input: string) =>
  input
    .split(/[\n,]+/g)
    .map((url) => url.trim())
    .filter(Boolean);

type SearchSlice = {
  urlsInput: string;
  isAnalyzing: boolean;
  mediaList: MediaItem[];
  activeMediaId: string | null;
  recentUrls: MediaItem[];
  streams: Stream[];
  presets: Preset[];
  selectedPresetId: string | null;
  selectedVideoId: string | null;
  selectedAudioId: string | null;
  setUrlsInput: (value: string) => void;
  setActiveMedia: (id: string) => void;
  analyzeUrls: () => Promise<void>;
  fetchPresets: () => Promise<void>;
  selectStream: (id: string) => void;
  setSelectedPreset: (id: string | null) => void;
  combineStreams: (videoId?: string | null, audioId?: string | null) => void;
};

type DownloadSlice = {
  jobs: DownloadJob[];
  history: DownloadJob[];
  fetchHistory: (query?: string) => Promise<void>;
  startDownload: () => Promise<void>;
  startJob: (id: string) => Promise<void>;
  cancelJob: (id: string) => Promise<void>;
  openCompletedDownload: (id: string) => Promise<void>;
  updateJob: (id: string, patch: Partial<DownloadJob>) => void;
};

type OptionsSlice = {
  options: DownloadOptions;
  profiles: Profile[];
  activeProfileId: string | null;
  setOption: <K extends keyof DownloadOptions>(key: K, value: DownloadOptions[K]) => void;
  setOptions: (patch: Partial<DownloadOptions>) => void;
  saveProfile: (name: string) => void;
  loadProfile: (id: string) => void;
  deleteProfile: (id: string) => void;
  resetOptions: () => void;
};

type AppState = SearchSlice & DownloadSlice & OptionsSlice;

const createSearchSlice: StateCreator<AppState, [], [], SearchSlice> = (set, get) => ({
  urlsInput: '',
  isAnalyzing: false,
  mediaList: [],
  activeMediaId: null,
  recentUrls: loadRecent(),
  streams: [],
  presets: [],
  selectedPresetId: null,
  selectedVideoId: null,
  selectedAudioId: null,
  setUrlsInput: (value) => set({ urlsInput: value }),
  setActiveMedia: (id) => set({ activeMediaId: id }),
  analyzeUrls: async () => {
    const urls = splitUrls(get().urlsInput);
    if (urls.length === 0) {
      useUiStore.getState().pushToast('No URLs detected', 'Paste at least one URL to analyze.', 'error');
      return;
    }

    set({ isAnalyzing: true });

    try {
      const response = await fetch(buildApiPath('/api/analyze'), {
        method: 'POST',
        headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ urls })
      });

      if (!response.ok) {
        const message = await readErrorMessage(response, 'Analyze failed');
        throw new Error(message);
      }
      const data = (await response.json()) as { items: MediaItem[]; streams?: Stream[]; failed?: number };
      if (!data.items?.length) throw new Error('No media found');

      const streams = data.streams ?? [];
      const recent = [data.items[0], ...get().recentUrls.filter((item) => item.id !== data.items[0].id)];
      saveRecent(recent);
      set({
        mediaList: data.items,
        activeMediaId: data.items[0].id,
        recentUrls: recent,
        streams,
        selectedVideoId: null,
        selectedAudioId: null
      });
      if (typeof data.failed === 'number' && data.failed > 0) {
        useUiStore.getState().pushToast(
          'Analysis complete',
          `Found ${data.items.length} item(s), ${data.failed} failed.`,
          'info'
        );
      } else {
        useUiStore.getState().pushToast('Analysis complete', `Found ${data.items.length} item(s).`, 'success');
      }
    } catch (error) {
      set({ mediaList: [], activeMediaId: null, streams: [], selectedVideoId: null, selectedAudioId: null });
      const message = error instanceof Error ? error.message : 'Unable to reach the server.';
      useUiStore.getState().pushToast('Analyze failed', message, 'error');
    } finally {
      set({ isAnalyzing: false });
    }
  },
  fetchPresets: async () => {
    try {
      const response = await fetch(buildApiPath('/api/formats'), {
        headers: withAuthHeaders()
      });
      if (!response.ok) throw new Error('Format fetch failed');
      const data = (await response.json()) as { presets: Preset[] };
      const presets = data.presets ?? [];
      const existingPresetId = get().selectedPresetId;
      set({
        presets,
        selectedPresetId: existingPresetId && presets.some((preset) => preset.id === existingPresetId) ? existingPresetId : null
      });
    } catch (error) {
      set({ presets: [] });
      useUiStore.getState().pushToast('Presets unavailable', 'Unable to load format presets.', 'error');
    }
  },
  selectStream: (id) => {
    const stream = get().streams.find((item) => item.id === id);
    if (!stream) return;
    if (stream.type === 'video') {
      set({ selectedVideoId: id });
    } else {
      set({ selectedAudioId: id });
    }
  },
  setSelectedPreset: (id) => set({ selectedPresetId: id }),
  combineStreams: (videoId, audioId) => {
    set({
      selectedVideoId: videoId ?? get().selectedVideoId,
      selectedAudioId: audioId ?? get().selectedAudioId
    });
  }
});

const createDownloadSlice: StateCreator<AppState, [], [], DownloadSlice> = (set, get) => ({
  jobs: [],
  history: [],
  fetchHistory: async (query) => {
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      const historyPath = params.size > 0 ? `/api/history?${params.toString()}` : '/api/history';
      const response = await fetch(buildApiPath(historyPath), {
        headers: withAuthHeaders()
      });
      if (!response.ok) throw new Error('History fetch failed');
      const data = (await response.json()) as { items: Array<Partial<DownloadJob>> };
      const items = (data.items ?? []).map((item) => ({
        id: item.id ?? getId(),
        title: item.title ?? 'Untitled',
        status: item.status ?? 'completed',
        progress: item.progress ?? 100,
        speed: item.speed ?? '—',
        eta: item.eta ?? '—',
        size: item.size ?? '—',
        format: item.format ?? '',
        startedAt: item.startedAt ?? '',
        finishedAt: item.finishedAt,
        filePath: item.filePath,
        logs: [],
        speedHistory: item.speedHistory ?? []
      })) as DownloadJob[];
      set({ history: items });
    } catch (error) {
      useUiStore.getState().pushToast('History unavailable', 'Unable to load download history.', 'error');
    }
  },
  startDownload: async () => {
    const media = get().mediaList.find((item) => item.id === get().activeMediaId);
    if (!media) {
      useUiStore.getState().pushToast('No media selected', 'Analyze a URL to start a download.', 'error');
      return;
    }
    const video = get().streams.find((item) => item.id === get().selectedVideoId);
    const audio = get().streams.find((item) => item.id === get().selectedAudioId);
    const preset = get().presets.find((item) => item.id === get().selectedPresetId);
    const hasManualStreamSelection = Boolean(video?.id || audio?.id);
    const rawOptions = get().options;
    const normalizedFormat = rawOptions.quality === 'audio'
      ? (audioFormats.has(rawOptions.format) ? rawOptions.format : 'any')
      : (videoFormats.has(rawOptions.format) ? rawOptions.format : 'any');
    const options: Partial<DownloadOptions> = {
      quality: rawOptions.quality,
      format: normalizedFormat,
      autoStart: rawOptions.autoStart,
      splitChapters: rawOptions.splitChapters,
      bypassResources: rawOptions.bypassResources
    };
    if (rawOptions.downloadFolder.trim()) options.downloadFolder = rawOptions.downloadFolder.trim();
    if (rawOptions.customNamePrefix.trim()) options.customNamePrefix = rawOptions.customNamePrefix.trim();
    if (rawOptions.itemsLimit > 0) options.itemsLimit = rawOptions.itemsLimit;
    if (rawOptions.chapterTemplate.trim()) options.chapterTemplate = rawOptions.chapterTemplate.trim();
    if (rawOptions.proxy.trim()) options.proxy = rawOptions.proxy.trim();
    if (rawOptions.rateLimit.trim()) options.rateLimit = rawOptions.rateLimit.trim();
    if (rawOptions.userAgent.trim()) options.userAgent = rawOptions.userAgent.trim();
    if (rawOptions.referrer.trim()) options.referrer = rawOptions.referrer.trim();
    if (rawOptions.sponsorBlock) options.sponsorBlock = true;
    if (rawOptions.subtitles) options.subtitles = true;
    if (rawOptions.embedMetadata) options.embedMetadata = true;
    if (rawOptions.embedThumbnail) options.embedThumbnail = true;
    if (rawOptions.fps60) options.fps60 = true;
    if (rawOptions.hdr) options.hdr = true;
    if (typeof rawOptions.audioQuality === 'number') options.audioQuality = rawOptions.audioQuality;
    if (rawOptions.audioFormat && rawOptions.audioFormat !== 'Original') options.audioFormat = rawOptions.audioFormat;
    if (rawOptions.container) options.container = rawOptions.container;

    let format = hasManualStreamSelection
      ? (video?.id && audio?.id ? `${video.id}+${audio.id}` : video?.id ?? audio?.id ?? undefined)
      : undefined;

    if (!hasManualStreamSelection) {
      if (rawOptions.quality === 'audio') {
        format = 'bestaudio/best';
      } else if (['2160', '1440', '1080', '720'].includes(rawOptions.quality)) {
        format = `bestvideo[height<=${rawOptions.quality}]+bestaudio/best`;
      } else {
        format = preset?.format ?? undefined;
      }
    }

    try {
      const response = await fetch(buildApiPath('/api/download'), {
        method: 'POST',
        headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          url: media.url,
          format,
          options
        })
      });

      if (!response.ok) {
        const message = await readErrorMessage(response, 'Download failed');
        throw new Error(message);
      }
      const data = (await response.json()) as { id: string; status?: DownloadJob['status']; resourceUnits?: number };
      const job: DownloadJob = {
        id: data.id,
        title: media.title,
        status: data.status ?? (rawOptions.autoStart ? 'queued' : 'paused'),
        progress: 0,
        speed: '—',
        eta: '—',
        size: '—',
        resourceUnits: data.resourceUnits,
        format: `${rawOptions.quality.toUpperCase()} / ${normalizedFormat.toUpperCase()}`,
        startedAt: new Date().toISOString(),
        logs: [rawOptions.autoStart ? '[queue] Job queued.' : '[pause] Job created. Start manually.'],
        speedHistory: [0]
      };

      set((state) => ({ jobs: [job, ...state.jobs] }));
      useUiStore.getState().pushToast('Download queued', 'Job added to the queue.', 'success');

      let progressPath: string | null = `/api/download/${data.id}/progress`;
      if (API_TOKEN) {
        try {
          const ticket = await requestScopedTicket('sse', data.id);
          progressPath = `${progressPath}?ticket=${encodeURIComponent(ticket)}`;
        } catch (error) {
          progressPath = null;
          const message = error instanceof Error ? error.message : 'Unable to initialize live progress updates.';
          useUiStore.getState().pushToast('Live updates unavailable', message, 'info');
        }
      }

      if (progressPath && !eventSources.has(data.id)) {
        const source = new EventSource(progressPath);
        eventSources.set(data.id, source);
        source.onmessage = (event) => {
          const payload = JSON.parse(event.data) as Partial<DownloadJob> & { log?: string };
          const { log, ...rest } = payload;
          const existingLogs = get().jobs.find((item) => item.id === data.id)?.logs ?? [];
          get().updateJob(data.id, {
            ...rest,
            logs: log ? [...existingLogs, log].slice(-120) : undefined
          });
          if (payload.status && terminalStatuses.includes(payload.status as DownloadJob['status'])) {
            closeEventSource(data.id);
          }
        };
        source.onerror = () => {
          closeEventSource(data.id);
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Server unreachable or download rejected.';
      useUiStore.getState().pushToast('Download failed', message, 'error');
    }
  },
  startJob: async (id) => {
    try {
      const response = await fetch(buildApiPath(`/api/download/${id}/start`), {
        method: 'POST',
        headers: withAuthHeaders()
      });
      if (!response.ok) throw new Error('Start failed');
      const data = (await response.json()) as { status?: DownloadJob['status'] };
      get().updateJob(id, {
        status: data.status ?? 'queued',
        logs: [...(get().jobs.find((job) => job.id === id)?.logs ?? []), '[queue] Job started.'].slice(-120)
      });
    } catch {
      useUiStore.getState().pushToast('Start failed', 'Unable to start this job.', 'error');
    }
  },
  cancelJob: async (id) => {
    try {
      const response = await fetch(buildApiPath(`/api/download/${id}`), {
        method: 'DELETE',
        headers: withAuthHeaders()
      });
      if (!response.ok) throw new Error('Cancel failed');
      get().updateJob(id, {
        status: 'cancelled',
        logs: [...(get().jobs.find((job) => job.id === id)?.logs ?? []), '[cancel] Job cancelled.'].slice(-120)
      });
    } catch {
      useUiStore.getState().pushToast('Cancel failed', 'Unable to cancel this job.', 'error');
    }
  },
  openCompletedDownload: async (id) => {
    try {
      let path = `/api/download/${id}/file`;
      if (API_TOKEN) {
        const ticket = await requestScopedTicket('file', id);
        path = `${path}?ticket=${encodeURIComponent(ticket)}`;
      }
      const link = document.createElement('a');
      link.href = path;
      link.rel = 'noopener';
      link.click();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open the download file.';
      useUiStore.getState().pushToast('Download open failed', message, 'error');
    }
  },
  updateJob: (id, patch) => {
    set((state) => ({
      jobs: state.jobs.map((job) => {
        if (job.id !== id) return job;
        const next = { ...job, ...patch };
        if (patch.logs) next.logs = patch.logs;
        if (patch.speedHistory && patch.speedHistory.length) next.speedHistory = patch.speedHistory;
        return next;
      })
    }));
    if (patch.status && terminalStatuses.includes(patch.status)) {
      closeEventSource(id);
      get().fetchHistory().catch(() => undefined);
    }
  }
});

const createOptionsSlice: StateCreator<AppState, [], [], OptionsSlice> = (set, get) => ({
  options: loadOptions(),
  profiles: loadProfiles(),
  activeProfileId: null,
  setOption: (key, value) => {
    set((state) => {
      const next = { ...state.options, [key]: value };
      saveOptions(next);
      return { options: next };
    });
  },
  setOptions: (patch) => {
    set((state) => {
      const next = { ...state.options, ...patch };
      saveOptions(next);
      return { options: next };
    });
  },
  saveProfile: (name) => {
    const trimmed = name.trim();
    if (!trimmed) {
      useUiStore.getState().pushToast('Profile name required', 'Enter a name to save a profile.', 'error');
      return;
    }
    const now = new Date().toISOString();
    const options = get().options;
    const existing = get().profiles.find((profile) => profile.name.toLowerCase() === trimmed.toLowerCase());
    let profiles: Profile[] = [];
    let activeProfileId: string | null = null;
    if (existing) {
      profiles = get().profiles.map((profile) =>
        profile.id === existing.id ? { ...profile, options } : profile
      );
      activeProfileId = existing.id;
    } else {
      const profile: Profile = { id: getId(), name: trimmed, createdAt: now, options };
      profiles = [profile, ...get().profiles].slice(0, 12);
      activeProfileId = profile.id;
    }
    saveProfiles(profiles);
    set({ profiles, activeProfileId });
    useUiStore.getState().pushToast('Profile saved', `Saved ${trimmed}.`, 'success');
  },
  loadProfile: (id) => {
    const profile = get().profiles.find((item) => item.id === id);
    if (!profile) return;
    saveOptions(profile.options);
    set({ options: profile.options, activeProfileId: profile.id });
    useUiStore.getState().pushToast('Profile loaded', `Applied ${profile.name}.`, 'success');
  },
  deleteProfile: (id) => {
    const profiles = get().profiles.filter((profile) => profile.id !== id);
    saveProfiles(profiles);
    set({
      profiles,
      activeProfileId: get().activeProfileId === id ? null : get().activeProfileId
    });
  },
  resetOptions: () => {
    saveOptions(defaultOptions);
    set({ options: defaultOptions, activeProfileId: null });
    useUiStore.getState().pushToast('Options reset', 'Reverted to defaults.', 'info');
  }
});

const useAppStore = create<AppState>()((...a) => ({
  ...createSearchSlice(...a),
  ...createDownloadSlice(...a),
  ...createOptionsSlice(...a)
}));

export default useAppStore;
