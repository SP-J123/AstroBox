export type MediaItem = {
  id: string;
  title: string;
  uploader: string;
  duration: number;
  views: number;
  date: string;
  platform: string;
  thumbnail: string;
  url: string;
  avatar: string;
  badge: string;
};

export type Stream = {
  id: string;
  type: 'video' | 'audio';
  label: string;
  resolution?: string;
  width?: number;
  height?: number;
  fps?: number;
  codec: string;
  size: number;
  quality: 'premium' | 'balanced' | 'economy';
  ext: string;
  hdr?: boolean;
  tbr?: number;
  abr?: number;
  vbr?: number;
  channels?: number;
  asr?: number;
};

export type Preset = {
  id: string;
  title: string;
  description: string;
  format: string;
};

export type DownloadOptions = {
  container: '' | 'MP4' | 'WebM' | 'MKV' | 'MOV';
  resolutionCap: 'Auto' | '2160p' | '1440p' | '1080p' | '720p';
  fps60: boolean;
  hdr: boolean;
  audioFormat: 'Original' | 'MP3' | 'AAC' | 'FLAC' | 'OPUS';
  audioQuality: number;
  sponsorBlock: boolean;
  subtitles: boolean;
  splitChapters: boolean;
  embedMetadata: boolean;
  embedThumbnail: boolean;
  proxy: string;
  rateLimit: string;
  userAgent: string;
  referrer: string;
  quality: 'best' | '2160' | '1440' | '1080' | '720' | 'audio';
  format: 'any' | 'mp4' | 'webm' | 'mkv' | 'mov' | 'mp3' | 'm4a' | 'aac' | 'opus' | 'flac';
  autoStart: boolean;
  downloadFolder: string;
  customNamePrefix: string;
  itemsLimit: number;
  chapterTemplate: string;
  bypassResources: boolean;
};

export type Profile = {
  id: string;
  name: string;
  createdAt: string;
  options: DownloadOptions;
};

export type JobStatus = 'paused' | 'queued' | 'downloading' | 'processing' | 'completed' | 'error' | 'cancelled';

export type DownloadJob = {
  id: string;
  title: string;
  status: JobStatus;
  progress: number;
  speed: string;
  eta: string;
  size: string;
  format: string;
  startedAt: string;
  finishedAt?: string;
  filePath?: string;
  resourceUnits?: number;
  logs: string[];
  speedHistory: number[];
};

export type ToastVariant = 'success' | 'error' | 'info';

export type Toast = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
};
