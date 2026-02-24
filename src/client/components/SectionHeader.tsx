import type { ReactNode } from 'react';

const SectionHeader = ({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-4">
    <div>
      <p className="text-sm uppercase tracking-[0.4em] text-electric/70">{title}</p>
      {subtitle ? <h2 className="mt-2 text-2xl font-semibold text-slate-50">{subtitle}</h2> : null}
    </div>
    {action ? <div>{action}</div> : null}
  </div>
);

export default SectionHeader;
