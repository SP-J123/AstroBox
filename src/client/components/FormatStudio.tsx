import { useMemo, useState } from 'react';
import { AudioWaveform, Film, Layers3, SlidersHorizontal } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import SectionHeader from './SectionHeader';
import { formatBytes } from '../utils/format';

const FormatStudio = () => {
  const { streams, presets, selectedPresetId, selectedAudioId, selectedVideoId, selectStream, setSelectedPreset, combineStreams } = useAppStore();
  const videoStreams = streams.filter((stream) => stream.type === 'video');
  const audioStreams = streams.filter((stream) => stream.type === 'audio');

  const [videoSort, setVideoSort] = useState<'resolution' | 'size' | 'fps'>('resolution');
  const [videoCodec, setVideoCodec] = useState('All');
  const [videoHdrOnly, setVideoHdrOnly] = useState(false);
  const [videoFps60, setVideoFps60] = useState(false);

  const [audioSort, setAudioSort] = useState<'size' | 'bitrate'>('size');
  const [audioCodec, setAudioCodec] = useState('All');

  const videoCodecs = useMemo(() => ['All', ...Array.from(new Set(videoStreams.map((stream) => stream.codec).filter(Boolean)))], [videoStreams]);
  const audioCodecs = useMemo(() => ['All', ...Array.from(new Set(audioStreams.map((stream) => stream.codec).filter(Boolean)))], [audioStreams]);

  const filteredVideo = useMemo(() => {
    let list = [...videoStreams];
    if (videoCodec !== 'All') list = list.filter((stream) => stream.codec === videoCodec);
    if (videoHdrOnly) list = list.filter((stream) => stream.hdr);
    if (videoFps60) list = list.filter((stream) => (stream.fps ?? 0) >= 60);

    const getResolution = (stream: typeof list[number]) => stream.height ?? 0;
    const getSize = (stream: typeof list[number]) => stream.size ?? 0;
    const getFps = (stream: typeof list[number]) => stream.fps ?? 0;

    list.sort((a, b) => {
      if (videoSort === 'size') return getSize(b) - getSize(a);
      if (videoSort === 'fps') return getFps(b) - getFps(a);
      return getResolution(b) - getResolution(a);
    });

    return list;
  }, [videoStreams, videoCodec, videoHdrOnly, videoFps60, videoSort]);

  const filteredAudio = useMemo(() => {
    let list = [...audioStreams];
    if (audioCodec !== 'All') list = list.filter((stream) => stream.codec === audioCodec);

    const getSize = (stream: typeof list[number]) => stream.size ?? 0;
    const getBitrate = (stream: typeof list[number]) => stream.abr ?? stream.tbr ?? 0;

    list.sort((a, b) => {
      if (audioSort === 'bitrate') return getBitrate(b) - getBitrate(a);
      return getSize(b) - getSize(a);
    });

    return list;
  }, [audioStreams, audioCodec, audioSort]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('type');
    const id = event.dataTransfer.getData('id');
    if (type === 'video') combineStreams(id, undefined);
    if (type === 'audio') combineStreams(undefined, id);
  };

  return (
    <section className="glass-card p-8">
      <SectionHeader
        title="Format Studio"
        subtitle="Visual stream builder"
        action={
          <div className="flex flex-wrap gap-2">
            {presets.length === 0 ? (
              <span className="text-xs text-slate-400">No presets loaded</span>
            ) : (
              presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedPreset(preset.id)}
                  className={`chip hover:border-electric/60 ${selectedPresetId === preset.id ? 'border-electric/60 text-electric' : ''}`}
                  title={preset.description}
                >
                  {preset.title}
                </button>
              ))
            )}
          </div>
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <SlidersHorizontal className="h-4 w-4" />
        Use real stream data from yt-dlp. Drag video + audio into the merge zone.
      </div>

      <div className="mt-8 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-5">
          <div className="flex items-center justify-between gap-3 text-sm text-slate-200">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-electric" />
              Video Streams
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                className="input-surface"
                value={videoSort}
                onChange={(event) => setVideoSort(event.target.value as typeof videoSort)}
              >
                <option value="resolution">Sort: Resolution</option>
                <option value="size">Sort: Filesize</option>
                <option value="fps">Sort: FPS</option>
              </select>
              <select
                className="input-surface"
                value={videoCodec}
                onChange={(event) => setVideoCodec(event.target.value)}
              >
                {videoCodecs.map((codec) => (
                  <option key={codec} value={codec}>{codec}</option>
                ))}
              </select>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={videoHdrOnly}
                  onChange={(event) => setVideoHdrOnly(event.target.checked)}
                  className="h-3 w-3 accent-electric"
                />
                HDR
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={videoFps60}
                  onChange={(event) => setVideoFps60(event.target.checked)}
                  className="h-3 w-3 accent-electric"
                />
                60fps+
              </label>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {filteredVideo.length === 0 ? (
              <div className="rounded-card border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-slate-400">
                Analyze a URL to load available video streams.
              </div>
            ) : (
              filteredVideo.map((stream) => (
                <div
                  key={stream.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('type', 'video');
                    event.dataTransfer.setData('id', stream.id);
                  }}
                  onClick={() => selectStream(stream.id)}
                  className={`cursor-grab rounded-card border border-white/10 bg-white/5 p-4 transition hover:-translate-y-0.5 ${stream.id === selectedVideoId ? 'border-electric/60 bg-electric/10' : 'hover:border-white/20'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{stream.label}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {stream.resolution} · {stream.fps ?? '—'}fps · {stream.codec}
                      </p>
                    </div>
                    <span className={`chip ${stream.quality === 'premium' ? 'border-electric/40 text-electric' : ''}`}>
                      {stream.quality}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="rounded-full bg-white/10 px-2 py-1">{formatBytes(stream.size)}</span>
                    {stream.hdr ? <span className="rounded-full bg-indigoGlow/20 px-2 py-1 text-indigoGlow">HDR</span> : null}
                    <span className="rounded-full bg-white/10 px-2 py-1">.{stream.ext}</span>
                    {stream.tbr ? <span className="rounded-full bg-white/10 px-2 py-1">{Math.round(stream.tbr)} kbps</span> : null}
                  </div>
                  <div className="mt-3 h-2 w-full rounded-full bg-white/5">
                    <div
                      className="progress-stripes h-2 rounded-full"
                      style={{ width: stream.quality === 'premium' ? '85%' : stream.quality === 'balanced' ? '65%' : '45%' }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-2">
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className="flex h-full flex-col items-center justify-center gap-4 rounded-card border border-dashed border-white/15 bg-white/5 p-6 text-center"
          >
            <Layers3 className="h-8 w-8 text-electric" />
            <p className="text-sm font-semibold text-slate-100">Drop streams to combine</p>
            <p className="text-xs text-slate-400">Drag video + audio cards here</p>
            <div className="mt-4 space-y-2 text-xs text-slate-300">
              <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Video: {videoStreams.find((item) => item.id === selectedVideoId)?.label ?? 'Auto'}</div>
              <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Audio: {audioStreams.find((item) => item.id === selectedAudioId)?.label ?? 'Auto'}</div>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <div className="flex items-center justify-between gap-3 text-sm text-slate-200">
            <div className="flex items-center gap-2">
              <AudioWaveform className="h-4 w-4 text-electric" />
              Audio Streams
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                className="input-surface"
                value={audioSort}
                onChange={(event) => setAudioSort(event.target.value as typeof audioSort)}
              >
                <option value="size">Sort: Filesize</option>
                <option value="bitrate">Sort: Bitrate</option>
              </select>
              <select
                className="input-surface"
                value={audioCodec}
                onChange={(event) => setAudioCodec(event.target.value)}
              >
                {audioCodecs.map((codec) => (
                  <option key={codec} value={codec}>{codec}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {filteredAudio.length === 0 ? (
              <div className="rounded-card border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-slate-400">
                Analyze a URL to load available audio streams.
              </div>
            ) : (
              filteredAudio.map((stream) => (
                <div
                  key={stream.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('type', 'audio');
                    event.dataTransfer.setData('id', stream.id);
                  }}
                  onClick={() => selectStream(stream.id)}
                  className={`cursor-grab rounded-card border border-white/10 bg-white/5 p-4 transition hover:-translate-y-0.5 ${stream.id === selectedAudioId ? 'border-electric/60 bg-electric/10' : 'hover:border-white/20'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{stream.label}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {stream.codec} · {formatBytes(stream.size)}
                        {stream.abr ? ` · ${Math.round(stream.abr)} kbps` : ''}
                      </p>
                    </div>
                    <span className={`chip ${stream.quality === 'premium' ? 'border-electric/40 text-electric' : ''}`}>
                      {stream.quality}
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="relative h-8 rounded-full bg-white/5">
                      <div className="absolute inset-0 flex items-center justify-center gap-1">
                        {Array.from({ length: 20 }).map((_, idx) => (
                          <span
                            key={idx}
                            className="h-[12px] w-1 rounded-full bg-electric/40"
                            style={{ opacity: 0.3 + (idx % 5) * 0.1 }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2 text-xs text-slate-400">
                    <span className="rounded-full bg-white/10 px-2 py-1">.{stream.ext}</span>
                    {stream.channels ? <span className="rounded-full bg-white/10 px-2 py-1">{stream.channels}ch</span> : null}
                    {stream.asr ? <span className="rounded-full bg-white/10 px-2 py-1">{stream.asr}Hz</span> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FormatStudio;
