import type { InstallProgress } from '../../shared/types';

interface ProgressBarProps {
  progress: InstallProgress;
  visible: boolean;
}

export default function ProgressBar({ progress, visible }: ProgressBarProps) {
  if (!visible) return null;

  const percentage = Math.max(0, Math.min(100, progress.percentage));

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 shadow-inner shadow-black/20">
      <div className="mb-3 flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-semibold text-zinc-100">{progress.status}</span>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-moss">
          {percentage}%
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full rounded-full bg-gradient-to-r from-grass via-moss to-[#E6B86A] shadow-[0_0_18px_rgba(141,211,107,.45)] transition-[width] duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
