import { CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

interface ToastProps {
  message: string;
  kind: 'info' | 'success' | 'error' | 'warning';
}

export function Toast({ message, kind }: ToastProps) {
  const config = {
    info: { icon: Info, bg: 'bg-teal', border: 'border-teal-light' },
    success: { icon: CheckCircle2, bg: 'bg-teal', border: 'border-mint' },
    error: { icon: AlertCircle, bg: 'bg-coral', border: 'border-coral-dark' },
    warning: { icon: AlertTriangle, bg: 'bg-amber-dark', border: 'border-amber' },
  };
  const { icon: Icon, bg, border } = config[kind];

  return (
    <div className={`${bg} ${border} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slide-in max-w-sm border-l-4`}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
