import { cn } from '../utils/cn';

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('shimmer rounded-card bg-white/5', className)} />
);

export default Skeleton;
