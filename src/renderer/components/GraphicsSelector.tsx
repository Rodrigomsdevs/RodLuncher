import { AlertTriangle } from 'lucide-react';
import type { GraphicsApi } from '../../shared/types';

interface GraphicsSelectorProps {
  value: GraphicsApi;
  onChange: (value: GraphicsApi) => void;
}

export default function GraphicsSelector({ value, onChange }: GraphicsSelectorProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-gold/55">
        Renderização
      </label>
      <div className="flex rounded-xl border border-gold/10 bg-black/25 p-1">
        {(['opengl', 'vulkan'] as const).map((api) => (
          <button
            key={api}
            type="button"
            onClick={() => onChange(api)}
            className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-[0.14em] transition ${
              value === api
                ? 'bg-gradient-to-r from-gold/20 to-moss/15 text-white shadow-[inset_0_0_0_1px_rgba(240,168,0,0.18)]'
                : 'text-gold/35 hover:text-glow'
            }`}
          >
            {api}
          </button>
        ))}
      </div>
      {value === 'vulkan' && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-400/70">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          Requer o mod VulkanMod (Fabric) — será baixado automaticamente.
        </p>
      )}
    </div>
  );
}
