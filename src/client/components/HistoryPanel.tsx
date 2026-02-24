import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import SectionHeader from './SectionHeader';

const HistoryPanel = () => {
  const { history, fetchHistory } = useAppStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchHistory().catch(() => undefined);
  }, [fetchHistory]);

  const filtered = useMemo(() => {
    if (!query.trim()) return history;
    const needle = query.trim().toLowerCase();
    return history.filter((job) => job.title.toLowerCase().includes(needle) || job.format.toLowerCase().includes(needle));
  }, [history, query]);

  return (
    <section className="glass-card p-8">
      <SectionHeader title="Download History" subtitle="Searchable archive" />
      <div className="mt-4 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-button border border-white/10 bg-white/5 px-4 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            placeholder="Search downloads, tags, platforms..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
        </div>
        <button
          className="button-ghost"
          onClick={() => {
            const headers = ['Title', 'Format', 'Size', 'Status', 'Started', 'Finished'];
            const rows = filtered.map((job) => [
              job.title,
              job.format,
              job.size,
              job.status,
              job.startedAt ?? '',
              job.finishedAt ?? ''
            ]);
            const csv = [headers, ...rows]
              .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
              .join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'download-history.csv';
            link.click();
            URL.revokeObjectURL(link.href);
          }}
        >
          Export CSV
        </button>
      </div>
      <div className="mt-4 overflow-hidden rounded-card border border-white/10">
        <table className="w-full text-left text-sm text-slate-200">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.3em] text-slate-400">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Format</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr className="border-t border-white/5">
                <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={4}>
                  No completed downloads yet.
                </td>
              </tr>
            ) : (
              filtered.map((job) => (
                <tr key={job.id} className="border-t border-white/5">
                  <td className="px-4 py-3 text-slate-100">{job.title}</td>
                  <td className="px-4 py-3 text-slate-300">{job.format}</td>
                  <td className="px-4 py-3 text-slate-300">{job.size}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">
                      {job.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default HistoryPanel;
