import useAppStore from '../store/useAppStore';
import RippleButton from './RippleButton';

const DownloadDashboard = () => {
  const jobs = useAppStore((state) => state.jobs);
  const startJob = useAppStore((state) => state.startJob);
  const cancelJob = useAppStore((state) => state.cancelJob);
  const openCompletedDownload = useAppStore((state) => state.openCompletedDownload);

  return (
    <section className="glass-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-100">Downloads</h2>
        <span className="text-xs text-slate-400">{jobs.length} active</span>
      </div>
      {jobs.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No downloads yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-card border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-slate-100">{job.title}</p>
                <span className="text-xs text-slate-300">{job.status}</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-electric transition-all"
                  style={{ width: `${Math.max(0, Math.min(job.progress, 100))}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                <span>{job.progress}%</span>
                <span>{job.speed}</span>
              </div>
              {typeof job.resourceUnits === 'number' && job.resourceUnits > 0 ? (
                <div className="mt-1 text-[11px] text-slate-500">Resource units: {job.resourceUnits}</div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {job.status === 'paused' ? (
                  <RippleButton variant="ghost" onClick={() => startJob(job.id)}>
                    Start
                  </RippleButton>
                ) : null}
                {job.status === 'queued' || job.status === 'downloading' || job.status === 'processing' ? (
                  <RippleButton variant="ghost" onClick={() => cancelJob(job.id)}>
                    Cancel
                  </RippleButton>
                ) : null}
                {job.status === 'completed' ? (
                  <RippleButton variant="ghost" onClick={() => openCompletedDownload(job.id)}>
                    Download File
                  </RippleButton>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default DownloadDashboard;
