import useAppStore from '../store/useAppStore';
import SectionHeader from './SectionHeader';
import RippleButton from './RippleButton';
import { cn } from '../utils/cn';

const columns: Array<{ id: 'queued' | 'downloading' | 'processing' | 'completed'; title: string }> = [
  { id: 'queued', title: 'Queued' },
  { id: 'downloading', title: 'Downloading' },
  { id: 'processing', title: 'Processing' },
  { id: 'completed', title: 'Completed' }
];

const QueueKanban = () => {
  const { jobs } = useAppStore();

  return (
    <section className="glass-card p-8">
      <SectionHeader
        title="Queue Kanban"
        subtitle="Live queue overview"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">Auto-retry enabled</span>
            <RippleButton variant="ghost">Batch Start</RippleButton>
            <RippleButton variant="ghost">Schedule</RippleButton>
            <span className="text-xs text-slate-400">Status is server-managed</span>
          </div>
        }
      />
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
        {columns.map((column) => (
          <div
            key={column.id}
            className="rounded-card border border-white/10 bg-white/5 p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-100">{column.title}</p>
              <span className="text-xs text-slate-400">
                {jobs.filter((job) => job.status === column.id).length}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {jobs
                .filter((job) => job.status === column.id)
                .map((job) => (
                  <div
                    key={job.id}
                    className={cn(
                      'rounded-card border border-white/10 bg-ink-950/70 p-3 text-xs text-slate-200 transition hover:border-electric/40',
                      job.status === 'downloading' && 'border-electric/50'
                    )}
                  >
                    <p className="text-sm font-semibold text-slate-100 truncate">{job.title}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-slate-400">{job.format}</p>
                    <div className="mt-2 flex items-center justify-between text-[10px]">
                      <span>{job.progress}%</span>
                      <span>{job.eta}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default QueueKanban;
