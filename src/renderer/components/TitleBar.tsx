import { Minus, Square, X } from 'lucide-react';
import logo from '../assets/logo.png';

export default function TitleBar() {
  return (
    <header className="app-drag flex h-9 shrink-0 select-none items-center justify-between border-b border-white/[0.06] bg-black/50 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <img src={logo} alt="RodLauncher" className="h-7 w-auto object-contain" draggable={false} />
      </div>

      <div className="app-no-drag flex items-center">
        <button
          type="button"
          onClick={() => void window.rodlauncher.minimize()}
          className="grid h-9 w-10 place-items-center text-white/30 transition hover:bg-white/[0.06] hover:text-white/80"
          title="Minimizar"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => void window.rodlauncher.maximize()}
          className="grid h-9 w-10 place-items-center text-white/30 transition hover:bg-white/[0.06] hover:text-white/80"
          title="Maximizar"
        >
          <Square className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => void window.rodlauncher.close()}
          className="grid h-9 w-10 place-items-center text-white/30 transition hover:bg-ember/80 hover:text-white"
          title="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
