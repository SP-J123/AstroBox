import { useRef } from 'react';
import { cn } from '../utils/cn';

const RippleButton = ({
  className,
  variant = 'primary',
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) => {
  const ref = useRef<HTMLButtonElement | null>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    const button = ref.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.4;
    const ripple = document.createElement('span');
    ripple.className = 'ripple-span';
    ripple.style.left = `${event.clientX - rect.left}px`;
    ripple.style.top = `${event.clientY - rect.top}px`;
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    button.appendChild(ripple);
    window.setTimeout(() => ripple.remove(), 600);
  };

  return (
    <button
      ref={ref}
      {...props}
      onPointerDown={handlePointerDown}
      className={cn(variant === 'primary' ? 'button-primary' : 'button-ghost', className)}
    >
      {children}
    </button>
  );
};

export default RippleButton;
