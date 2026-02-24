import { useId } from 'react';
import { cn } from '../utils/cn';

const ProgressRing = ({ value, size = 92, className }: { value: number; size?: number; className?: string }) => {
  const gradientId = useId();
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} className={cn('text-electric', className)}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={`url(#${gradientId})`}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={dash}
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>
      </defs>
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        className="fill-slate-100 text-sm font-semibold"
      >
        {Math.round(value)}%
      </text>
    </svg>
  );
};

export default ProgressRing;
