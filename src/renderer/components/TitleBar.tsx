import { Minus, Square, X } from 'lucide-react';

export default function TitleBar() {
  return (
    <header className="app-drag flex h-10 select-none items-center justify-between border-b border-white/10 bg-black/35 px-3 text-zinc-300 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em]">
        <span className="h-3 w-3 rounded-[3px] bg-grass shadow-[0_0_14px_rgba(90,158,75,.85)]" />
        RodLauncher
      </div>

      <div className="app-no-drag flex items-center gap-1">
        <button
          type="button"
          onClick={() => void window.rodlauncher.minimize()}
          className="grid h-8 w-9 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white"
          title="Minimizar"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => void window.rodlauncher.maximize()}
          className="grid h-8 w-9 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white"
          title="Maximizar"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => void window.rodlauncher.close()}
          className="grid h-8 w-9 place-items-center rounded-lg text-zinc-400 transition hover:bg-ember hover:text-white"
          title="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
