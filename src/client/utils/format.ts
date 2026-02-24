export function formatBytes(bytes = 0) {
  if (!bytes || Number.isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** idx;
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[idx]}`;
}

export function formatDuration(seconds = 0) {
  if (!seconds || Number.isNaN(seconds)) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const padded = `${minutes}`.padStart(2, '0');
  const paddedSecs = `${secs}`.padStart(2, '0');
  return hours > 0 ? `${hours}:${padded}:${paddedSecs}` : `${minutes}:${paddedSecs}`;
}

export function formatViews(views = 0) {
  if (!views || Number.isNaN(views)) return '0';
  if (views >= 1_000_000_000) return `${(views / 1_000_000_000).toFixed(1)}B`;
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return `${views}`;
}
