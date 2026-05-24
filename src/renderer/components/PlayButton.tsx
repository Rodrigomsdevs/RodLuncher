import { Download, Gamepad2, Loader2, Play } from 'lucide-react';

interface PlayButtonProps {
  disabled: boolean;
  loading: boolean;
  gameRunning: boolean;
  installed: boolean;
  onClick: () => void;
}

export default function PlayButton({
  disabled,
  loading,
  gameRunning,
  installed,
  onClick,
}: PlayButtonProps) {
  const icon = loading ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : gameRunning ? (
    <Gamepad2 className="h-4 w-4" />
  ) : installed ? (
    <Play className="h-4 w-4 fill-current" />
  ) : (
    <Download className="h-4 w-4" />
  );

  const label = loading
    ? 'Aguarde...'
    : gameRunning
      ? 'Jogando'
      : installed
        ? 'Jogar'
        : 'Baixar e Jogar';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-center gap-2.5 rounded-xl px-6 py-3.5 text-sm font-bold uppercase tracking-[0.12em] transition-all ${
        gameRunning
          ? 'cursor-default border border-moss/30 bg-moss/10 text-moss/70'
          : disabled
            ? 'cursor-not-allowed border border-white/[0.06] bg-white/[0.03] text-white/20'
            : 'border border-grass/30 bg-gradient-to-r from-grass to-[#4a8a3b] text-white shadow-lg shadow-grass/20 hover:-translate-y-0.5 hover:shadow-grass/30 active:translate-y-0'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
