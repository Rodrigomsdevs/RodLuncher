import { Minus, Square, X } from 'lucide-react';
import logo from '../assets/logo.png';

export default function TitleBar() {
  return (
    <header className="app-drag flex h-9 shrink-0 select-none items-center justify-between border-b border-gold/10 bg-black/70 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <img src={logo} alt="RodLauncher" className="h-7 w-auto object-contain" draggable={false} />
      </div>

      <div className="app-no-drag flex items-center">
        <button
          type="button"
          onClick={() => void window.rodlauncher.minimize()}
          className="grid h-9 w-10 place-items-center text-gold/35 transition hover:bg-gold/[0.08] hover:text-glow"
          title="Minimizar"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => void window.rodlauncher.maximize()}
          className="grid h-9 w-10 place-items-center text-gold/35 transition hover:bg-gold/[0.08] hover:text-glow"
          title="Maximizar"
        >
          <Square className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => void window.rodlauncher.close()}
          className="grid h-9 w-10 place-items-center text-gold/35 transition hover:bg-ember/80 hover:text-white"
          title="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
