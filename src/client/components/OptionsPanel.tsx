import { useMemo, useState } from 'react';
import { SlidersHorizontal, ShieldCheck, Speaker, Video, Wifi } from 'lucide-react';
import SectionHeader from './SectionHeader';
import useAppStore from '../store/useAppStore';

const OptionsPanel = () => {
  const options = useAppStore((state) => state.options);
  const setOption = useAppStore((state) => state.setOption);
  const profiles = useAppStore((state) => state.profiles);
  const activeProfileId = useAppStore((state) => state.activeProfileId);
  const saveProfile = useAppStore((state) => state.saveProfile);
  const loadProfile = useAppStore((state) => state.loadProfile);
  const deleteProfile = useAppStore((state) => state.deleteProfile);
  const resetOptions = useAppStore((state) => state.resetOptions);
  const [profileName, setProfileName] = useState('');

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId),
    [profiles, activeProfileId]
  );

  return (
    <section className="glass-card p-8">
      <SectionHeader
        title="Advanced Controls"
        subtitle="Precision tuning for every workflow"
        action={<span className="chip">Profiles enabled</span>}
      />

      <div className="mt-8 rounded-card border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-100">Configuration Profiles</p>
            <p className="mt-1 text-xs text-slate-400">Save, load, and reuse your best download recipes.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeProfileId ?? ''}
              onChange={(event) => {
                const id = event.target.value;
                if (id) loadProfile(id);
              }}
              className="input-surface w-56"
            >
              <option value="">Select profile</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
            <input
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              placeholder="Profile name"
              className="input-surface w-48"
            />
            <button
              className="button-primary"
              onClick={() => {
                saveProfile(profileName);
                setProfileName('');
              }}
            >
              Save Profile
            </button>
            <button className="button-ghost" onClick={resetOptions}>
              Reset Defaults
            </button>
          </div>
        </div>
        {activeProfile ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Active: {activeProfile.name}</span>
            <span>Created {new Date(activeProfile.createdAt).toLocaleString()}</span>
            <button className="text-rose-300 hover:text-rose-200" onClick={() => deleteProfile(activeProfile.id)}>
              Delete profile
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-card border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <Video className="h-4 w-4 text-electric" />
            Video Options
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <span>Container Format</span>
              <select
                className="input-surface w-40"
                value={options.container}
                onChange={(event) => setOption('container', event.target.value as typeof options.container)}
              >
                <option>MP4</option>
                <option>WebM</option>
                <option>MKV</option>
                <option>MOV</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span>Resolution Cap</span>
              <select
                className="input-surface w-40"
                value={options.resolutionCap}
                onChange={(event) => setOption('resolutionCap', event.target.value as typeof options.resolutionCap)}
              >
                <option>Auto</option>
                <option>2160p</option>
                <option>1440p</option>
                <option>1080p</option>
                <option>720p</option>
              </select>
            </div>
            <label className="flex items-center justify-between">
              <span>60fps Priority</span>
              <input
                type="checkbox"
                checked={options.fps60}
                onChange={(event) => setOption('fps60', event.target.checked)}
                className="h-4 w-4 accent-electric"
              />
            </label>
            <label className="flex items-center justify-between">
              <span>HDR Preference</span>
              <input
                type="checkbox"
                checked={options.hdr}
                onChange={(event) => setOption('hdr', event.target.checked)}
                className="h-4 w-4 accent-indigoGlow"
              />
            </label>
          </div>
        </div>
        <div className="rounded-card border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <Speaker className="h-4 w-4 text-electric" />
            Audio Options
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <span>Extraction Mode</span>
              <select
                className="input-surface w-40"
                value={options.audioFormat}
                onChange={(event) => setOption('audioFormat', event.target.value as typeof options.audioFormat)}
              >
                <option>Original</option>
                <option>MP3</option>
                <option>AAC</option>
                <option>FLAC</option>
                <option>OPUS</option>
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs">
                <span>Quality</span>
                <span className="text-slate-400">{options.audioQuality}</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={options.audioQuality}
                onChange={(event) => setOption('audioQuality', Number(event.target.value))}
                className="mt-2 w-full accent-electric"
              />
            </div>
            <label className="flex items-center justify-between">
              <span>Embed Metadata</span>
              <input
                type="checkbox"
                checked={options.embedMetadata}
                onChange={(event) => setOption('embedMetadata', event.target.checked)}
                className="h-4 w-4 accent-electric"
              />
            </label>
            <label className="flex items-center justify-between">
              <span>Embed Thumbnail</span>
              <input
                type="checkbox"
                checked={options.embedThumbnail}
                onChange={(event) => setOption('embedThumbnail', event.target.checked)}
                className="h-4 w-4 accent-indigoGlow"
              />
            </label>
          </div>
        </div>
        <div className="rounded-card border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <ShieldCheck className="h-4 w-4 text-electric" />
            Post-Processing
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <label className="flex items-center justify-between">
              <span>SponsorBlock (skip segments)</span>
              <input
                type="checkbox"
                checked={options.sponsorBlock}
                onChange={(event) => setOption('sponsorBlock', event.target.checked)}
                className="h-4 w-4 accent-electric"
              />
            </label>
            <label className="flex items-center justify-between">
              <span>Embed Subtitles</span>
              <input
                type="checkbox"
                checked={options.subtitles}
                onChange={(event) => setOption('subtitles', event.target.checked)}
                className="h-4 w-4 accent-indigoGlow"
              />
            </label>
            <label className="flex items-center justify-between">
              <span>Chapter Splitting</span>
              <input
                type="checkbox"
                checked={options.splitChapters}
                onChange={(event) => setOption('splitChapters', event.target.checked)}
                className="h-4 w-4 accent-electric"
              />
            </label>
            <label className="flex items-center justify-between">
              <span>Metadata Write</span>
              <input type="checkbox" checked={options.embedMetadata} readOnly className="h-4 w-4 accent-electric" />
            </label>
          </div>
        </div>
        <div className="rounded-card border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <Wifi className="h-4 w-4 text-electric" />
            Network + Smart
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <span>Proxy</span>
              <input
                className="input-surface w-40"
                placeholder="socks5://..."
                value={options.proxy}
                onChange={(event) => setOption('proxy', event.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span>Rate Limit</span>
              <input
                className="input-surface w-40"
                placeholder="8M"
                value={options.rateLimit}
                onChange={(event) => setOption('rateLimit', event.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span>User-Agent</span>
              <input
                className="input-surface w-40"
                placeholder="Mozilla/5.0"
                value={options.userAgent}
                onChange={(event) => setOption('userAgent', event.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span>Referrer</span>
              <input
                className="input-surface w-40"
                placeholder="https://example.com"
                value={options.referrer}
                onChange={(event) => setOption('referrer', event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3 text-xs text-slate-400">
        <SlidersHorizontal className="h-4 w-4" />
        Save this configuration as a reusable profile for batch workflows.
      </div>
    </section>
  );
};

export default OptionsPanel;
