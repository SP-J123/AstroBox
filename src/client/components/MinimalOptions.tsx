import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import type { DownloadOptions } from '../store/types';

const videoFormats: Array<DownloadOptions['format']> = ['any', 'mp4', 'webm', 'mkv', 'mov'];
const audioFormats: Array<DownloadOptions['format']> = ['any', 'mp3', 'm4a', 'aac', 'opus', 'flac'];

const MinimalOptions = () => {
  const { options, setOption } = useAppStore();
  const activeAdvanced = useMemo(() => {
    let count = 0;
    if (options.container.trim()) count += 1;
    if (options.resolutionCap !== 'Auto') count += 1;
    if (options.audioFormat !== 'Original') count += 1;
    if (typeof options.audioQuality === 'number' && options.audioQuality !== 7) count += 1;
    if (options.downloadFolder.trim()) count += 1;
    if (options.customNamePrefix.trim()) count += 1;
    if (options.itemsLimit > 0) count += 1;
    if (options.splitChapters) count += 1;
    if (options.proxy.trim()) count += 1;
    if (options.rateLimit.trim()) count += 1;
    if (options.userAgent.trim()) count += 1;
    if (options.referrer.trim()) count += 1;
    if (options.subtitles) count += 1;
    if (options.sponsorBlock) count += 1;
    if (options.fps60) count += 1;
    if (options.hdr) count += 1;
    if (options.embedMetadata) count += 1;
    if (options.embedThumbnail) count += 1;
    return count;
  }, [options]);
  const [showAdvanced, setShowAdvanced] = useState(activeAdvanced > 0);
  const formatChoices = options.quality === 'audio' ? audioFormats : videoFormats;

  const applyPreset = (preset: 'mp3_fast' | 'mp4_1080' | 'best_video' | 'archive_audio') => {
    if (preset === 'mp3_fast') {
      setOption('quality', 'audio');
      setOption('format', 'mp3');
      setOption('autoStart', true);
      return;
    }
    if (preset === 'mp4_1080') {
      setOption('quality', '1080');
      setOption('format', 'mp4');
      setOption('autoStart', true);
      return;
    }
    if (preset === 'best_video') {
      setOption('quality', 'best');
      setOption('format', 'mp4');
      setOption('autoStart', true);
      return;
    }
    setOption('quality', 'audio');
    setOption('format', 'flac');
    setOption('autoStart', false);
    setOption('splitChapters', false);
  };

  return (
    <section className="glass-card mt-6 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-100">Download Settings</h2>
        <button
          type="button"
          className="button-ghost text-xs"
          onClick={() => setShowAdvanced((value) => !value)}
        >
          Advanced Options
          {activeAdvanced > 0 ? ` (${activeAdvanced})` : ''}
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-slate-300">Quality</span>
          <select
            className="input-surface w-full text-sm"
            value={options.quality}
            onChange={(event) => {
              const quality = event.target.value as typeof options.quality;
              const nextFormat = quality === 'audio'
                ? (audioFormats.includes(options.format) ? options.format : 'mp3')
                : (videoFormats.includes(options.format) ? options.format : 'mp4');
              setOption('quality', quality);
              setOption('format', nextFormat);
            }}
          >
            <option value="best">Best</option>
            <option value="2160">2160p</option>
            <option value="1440">1440p</option>
            <option value="1080">1080p</option>
            <option value="720">720p</option>
            <option value="audio">Audio Only</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-300">Format</span>
          <select
            className="input-surface w-full text-sm"
            value={options.format}
            onChange={(event) => setOption('format', event.target.value as typeof options.format)}
          >
            {formatChoices.map((choice) => (
              <option key={choice} value={choice}>
                {choice.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-300">Auto Start</span>
          <select
            className="input-surface w-full text-sm"
            value={options.autoStart ? 'yes' : 'no'}
            onChange={(event) => setOption('autoStart', event.target.value === 'yes')}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="chip" onClick={() => applyPreset('mp3_fast')}>
          MP3 Quick
        </button>
        <button type="button" className="chip" onClick={() => applyPreset('mp4_1080')}>
          MP4 1080p
        </button>
        <button type="button" className="chip" onClick={() => applyPreset('best_video')}>
          Best Video
        </button>
        <button type="button" className="chip" onClick={() => applyPreset('archive_audio')}>
          FLAC Archive
        </button>
      </div>

      {!showAdvanced && activeAdvanced > 0 ? (
        <div className="mt-3 text-xs text-slate-400">
          Advanced settings are active and will be applied.
        </div>
      ) : null}

      {showAdvanced ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-slate-300">Container</span>
            <select
              className="input-surface w-full text-sm"
              value={options.container || ''}
              onChange={(event) => setOption('container', event.target.value as typeof options.container)}
            >
              <option value="">Auto</option>
              <option value="MP4">MP4</option>
              <option value="WebM">WebM</option>
              <option value="MKV">MKV</option>
              <option value="MOV">MOV</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-slate-300">Resolution Cap</span>
            <select
              className="input-surface w-full text-sm"
              value={options.resolutionCap}
              onChange={(event) => setOption('resolutionCap', event.target.value as typeof options.resolutionCap)}
            >
              <option value="Auto">Auto</option>
              <option value="2160p">2160p</option>
              <option value="1440p">1440p</option>
              <option value="1080p">1080p</option>
              <option value="720p">720p</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-slate-300">Audio Format</span>
            <select
              className="input-surface w-full text-sm"
              value={options.audioFormat}
              onChange={(event) => setOption('audioFormat', event.target.value as typeof options.audioFormat)}
            >
              <option value="Original">Original</option>
              <option value="MP3">MP3</option>
              <option value="AAC">AAC</option>
              <option value="FLAC">FLAC</option>
              <option value="OPUS">OPUS</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-slate-300">Audio Quality (0-10)</span>
            <input
              type="number"
              min={0}
              max={10}
              className="input-surface w-full text-sm"
              value={typeof options.audioQuality === 'number' ? options.audioQuality : 7}
              onChange={(event) => setOption('audioQuality', Math.max(0, Math.min(10, Number(event.target.value) || 0)))}
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-slate-300">Download Folder</span>
            <input
              className="input-surface w-full text-sm"
              placeholder="Default"
              value={options.downloadFolder}
              onChange={(event) => setOption('downloadFolder', event.target.value)}
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-slate-300">Custom Name Prefix</span>
            <input
              className="input-surface w-full text-sm"
              placeholder="Default"
              value={options.customNamePrefix}
              onChange={(event) => setOption('customNamePrefix', event.target.value)}
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-slate-300">Items Limit</span>
            <input
              type="number"
              min={0}
              max={500}
              className="input-surface w-full text-sm"
              placeholder="Default"
              value={options.itemsLimit}
              onChange={(event) => setOption('itemsLimit', Math.max(0, Number(event.target.value) || 0))}
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-slate-300">Rate Limit</span>
            <input
              className="input-surface w-full text-sm"
              placeholder="e.g. 8M"
              value={options.rateLimit}
              onChange={(event) => setOption('rateLimit', event.target.value)}
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-slate-300">Proxy</span>
            <input
              className="input-surface w-full text-sm"
              placeholder="http://host:port"
              value={options.proxy}
              onChange={(event) => setOption('proxy', event.target.value)}
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-slate-300">User Agent</span>
            <input
              className="input-surface w-full text-sm"
              placeholder="Optional"
              value={options.userAgent}
              onChange={(event) => setOption('userAgent', event.target.value)}
            />
          </label>

          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-300">Referrer</span>
            <input
              className="input-surface w-full text-sm"
              placeholder="https://example.com"
              value={options.referrer}
              onChange={(event) => setOption('referrer', event.target.value)}
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 accent-electric"
              checked={options.splitChapters}
              onChange={(event) => setOption('splitChapters', event.target.checked)}
            />
            Split by chapters
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 accent-electric"
              checked={options.subtitles}
              onChange={(event) => setOption('subtitles', event.target.checked)}
            />
            Embed subtitles
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 accent-electric"
              checked={options.sponsorBlock}
              onChange={(event) => setOption('sponsorBlock', event.target.checked)}
            />
            SponsorBlock remove
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 accent-electric"
              checked={options.fps60}
              onChange={(event) => setOption('fps60', event.target.checked)}
            />
            Prefer 60 FPS
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 accent-electric"
              checked={options.hdr}
              onChange={(event) => setOption('hdr', event.target.checked)}
            />
            Prefer HDR
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 accent-electric"
              checked={options.embedMetadata}
              onChange={(event) => setOption('embedMetadata', event.target.checked)}
            />
            Embed metadata
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 accent-electric"
              checked={options.embedThumbnail}
              onChange={(event) => setOption('embedThumbnail', event.target.checked)}
            />
            Embed thumbnail
          </label>

          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-300">Template</span>
            <input
              className="input-surface w-full text-sm"
              value={options.chapterTemplate}
              onChange={(event) => setOption('chapterTemplate', event.target.value)}
            />
          </label>
        </div>
      ) : null}

      <p className="mt-4 text-xs text-slate-500">Conversion engine: yt-dlp + ffmpeg.</p>
    </section>
  );
};

export default MinimalOptions;
