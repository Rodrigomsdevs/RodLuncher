import { Download, Loader2, Play } from 'lucide-react';

interface PlayButtonProps {
  disabled: boolean;
  loading: boolean;
  installed: boolean;
  onClick: () => void;
}

export default function PlayButton({ disabled, loading, installed, onClick }: PlayButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative flex h-14 min-w-48 items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-grass via-[#6FB956] to-[#D9A441] px-7 text-base font-black uppercase tracking-[0.14em] text-white shadow-[0_18px_42px_rgba(90,158,75,.28)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(90,158,75,.36)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
    >
      <span className="absolute inset-0 bg-white/0 transition group-hover:bg-white/10" />
      {loading ? (
        <Loader2 className="relative h-5 w-5 animate-spin" />
      ) : installed ? (
        <Play className="relative h-5 w-5 fill-white" />
      ) : (
        <Download className="relative h-5 w-5" />
      )}
      <span className="relative">{loading ? 'Aguarde' : installed ? 'Jogar' : 'Baixar'}</span>
    </button>
  );
}
