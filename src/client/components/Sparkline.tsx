import { useId } from 'react';
import { cn } from '../utils/cn';

const Sparkline = ({ values, className }: { values: number[]; className?: string }) => {
  const gradientId = useId();
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * 100;
    const y = 100 - (value / max) * 100;
    return `${x},${y}`;
  });

  return (
    <svg viewBox="0 0 100 100" className={cn('h-12 w-full', className)} preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(' ')}
      />
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default Sparkline;
