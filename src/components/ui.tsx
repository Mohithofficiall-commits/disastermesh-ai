import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  color?: 'teal' | 'coral' | 'amber' | 'mint' | 'slate' | 'ivory';
  size?: 'sm' | 'md';
}

export function Badge({ children, color = 'slate', size = 'sm' }: BadgeProps) {
  const colors: Record<string, string> = {
    teal: 'bg-teal/15 text-teal-deep border-teal/20',
    coral: 'bg-coral/15 text-coral-dark border-coral/20',
    amber: 'bg-amber/20 text-amber-dark border-amber/30',
    mint: 'bg-mint/25 text-teal-deep border-mint/30',
    slate: 'bg-slate-forest/10 text-slate-forest border-slate-forest/15',
    ivory: 'bg-ivory text-slate-forest border-sand',
  };
  const sizes: Record<string, string> = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-medium ${colors[color]} ${sizes[size]}`}>
      {children}
    </span>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white/90 backdrop-blur rounded-2xl border border-sand shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-forest">{title}</h1>
        {subtitle && <p className="text-sm text-slate-muted mt-1">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'amber';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  title?: string;
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  title,
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary: 'bg-teal text-white hover:bg-teal-deep border-teal',
    secondary: 'bg-white text-slate-forest hover:bg-mint-pale border-sand',
    danger: 'bg-coral text-white hover:bg-coral-dark border-coral',
    ghost: 'bg-transparent text-slate-forest hover:bg-sand/50 border-transparent',
    amber: 'bg-amber text-slate-forest hover:bg-amber-dark hover:text-white border-amber',
  };
  const sizes: Record<string, string> = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-2',
    lg: 'text-base px-6 py-3',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium border transition-all ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  accent?: 'teal' | 'coral' | 'amber' | 'mint' | 'slate';
  sublabel?: string;
}

export function StatCard({ label, value, icon, accent = 'teal', sublabel }: StatCardProps) {
  const accents: Record<string, string> = {
    teal: 'bg-teal/10 text-teal',
    coral: 'bg-coral/10 text-coral-dark',
    amber: 'bg-amber/15 text-amber-dark',
    mint: 'bg-mint/20 text-teal-deep',
    slate: 'bg-slate-forest/10 text-slate-forest',
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-muted font-medium">{label}</p>
          <p className="text-3xl font-bold text-slate-forest mt-1">{value}</p>
          {sublabel && <p className="text-xs text-slate-muted mt-1">{sublabel}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${accents[accent]}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

export function EmptyState({ message, icon }: { message: string; icon: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-sand/50 flex items-center justify-center text-slate-muted mb-3">
        {icon}
      </div>
      <p className="text-slate-muted text-sm">{message}</p>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-slate-forest/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-ivory rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col border border-sand">
        <div className="px-6 py-4 border-b border-sand flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-forest">{title}</h2>
          <button onClick={onClose} className="text-slate-muted hover:text-slate-forest text-xl leading-none">
            ×
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-sand flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function FormField({
  label,
  children,
  required,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-forest mb-1.5">
        {label}
        {required && <span className="text-coral ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

export const inputClass =
  'w-full rounded-lg border border-sand bg-white px-3 py-2 text-sm text-slate-forest focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 transition-all';

export function severityColor(sev: string): 'coral' | 'amber' | 'teal' | 'mint' {
  switch (sev) {
    case 'critical': return 'coral';
    case 'high': return 'amber';
    case 'medium': return 'teal';
    default: return 'mint';
  }
}

export function statusColor(status: string): 'coral' | 'amber' | 'teal' | 'mint' | 'slate' {
  switch (status) {
    case 'active':
    case 'pending':
    case 'in_progress':
    case 'unresolved':
      return 'amber';
    case 'resolved':
    case 'completed':
    case 'acknowledged':
      return 'mint';
    case 'false_alarm':
    case 'cancelled':
    case 'failed':
      return 'coral';
    case 'monitoring':
    case 'assigned':
    case 'delivered':
      return 'teal';
    default:
      return 'slate';
  }
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
