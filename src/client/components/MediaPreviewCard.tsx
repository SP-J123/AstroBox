import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import RippleButton from './RippleButton';
import { formatDuration, formatViews } from '../utils/format';
import Skeleton from './Skeleton';

const fallbackThumb = (title: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="22">
        ${title.replace(/[<>&"]/g, '').slice(0, 36) || 'No Preview'}
      </text>
    </svg>`
  )}`;

const normalizeThumbnailUrl = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && trimmed.startsWith('http://')) {
    return `https://${trimmed.slice('http://'.length)}`;
  }
  return trimmed;
};

const MediaPreviewCard = () => {
  const { mediaList, activeMediaId, isAnalyzing, setActiveMedia, startDownload } = useAppStore();
  const activeMedia = mediaList.find((item) => item.id === activeMediaId);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [activeMedia?.id]);
  const imageSrc = useMemo(() => {
    if (!activeMedia) return '';
    if (imageFailed || !activeMedia.thumbnail) return fallbackThumb(activeMedia.title);
    const normalized = normalizeThumbnailUrl(activeMedia.thumbnail);
    return normalized || fallbackThumb(activeMedia.title);
  }, [activeMedia, imageFailed]);

  if (isAnalyzing) {
    return (
      <div className="glass-card p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!activeMedia) {
    return (
      <div className="glass-card p-5 text-sm text-slate-400">
        Analyze a URL to show media details.
      </div>
    );
  }

  return (
    <section className="glass-card grid grid-cols-1 gap-5 p-5 sm:grid-cols-[220px_1fr]">
      <img
        src={imageSrc}
        alt={activeMedia.title}
        className="h-36 w-full rounded-card object-cover"
        onError={() => setImageFailed(true)}
      />
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-50">{activeMedia.title}</h3>
            <p className="mt-1 text-sm text-slate-300">{activeMedia.uploader}</p>
            <p className="mt-1 text-xs text-slate-400">
              {formatDuration(activeMedia.duration)} - {formatViews(activeMedia.views)} views
            </p>
          </div>
          {mediaList.length > 1 ? (
            <select
              value={activeMedia.id}
              onChange={(event) => {
                setImageFailed(false);
                setActiveMedia(event.target.value);
              }}
              className="input-surface bg-ink-950 text-xs text-slate-100"
            >
              {mediaList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <RippleButton onClick={startDownload}>
            <Download className="h-4 w-4" />
            Download
          </RippleButton>
          <RippleButton variant="ghost" onClick={() => window.open(activeMedia.url, '_blank', 'noopener,noreferrer')}>
            <ExternalLink className="h-4 w-4" />
            Open
          </RippleButton>
        </div>
      </div>
    </section>
  );
};

export default MediaPreviewCard;
