import { AnimatePresence, motion } from 'framer-motion';
import type { InstallProgress } from '../../shared/types';

interface ProgressBarProps {
  progress: InstallProgress;
  visible: boolean;
}

const PHASE_LABELS: Record<string, string> = {
  preparing: 'Preparando',
  version: 'Versão',
  libraries: 'Bibliotecas',
  assets: 'Assets',
  java: 'Java',
  mods: 'Mods',
  launching: 'Iniciando',
  ready: 'Pronto',
  error: 'Erro',
};

export default function ProgressBar({ progress, visible }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, progress.percentage));
  const phaseLabel = PHASE_LABELS[progress.phase] ?? progress.phase;
  const isError = progress.phase === 'error';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                    isError
                      ? 'bg-ember/15 text-ember'
                      : 'bg-moss/10 text-moss/80'
                  }`}
                >
                  {phaseLabel}
                </span>
                <span className="truncate text-xs text-white/50">{progress.status}</span>
              </div>
              <span className="shrink-0 text-xs font-bold tabular-nums text-white/30">
                {pct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className={`h-full rounded-full ${
                  isError
                    ? 'bg-ember'
                    : 'bg-gradient-to-r from-grass to-moss'
                }`}
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
