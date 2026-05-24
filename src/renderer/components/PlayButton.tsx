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
            ? 'cursor-not-allowed border border-gold/[0.07] bg-gold/[0.03] text-gold/25'
            : 'border border-gold/40 bg-gradient-to-r from-gold via-glow to-moss text-black shadow-lg shadow-gold/25 hover:-translate-y-0.5 hover:shadow-moss/30 active:translate-y-0'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
