import { AlertTriangle } from 'lucide-react';
import type { GraphicsApi } from '../../shared/types';

interface GraphicsSelectorProps {
  value: GraphicsApi;
  onChange: (value: GraphicsApi) => void;
}

export default function GraphicsSelector({ value, onChange }: GraphicsSelectorProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
        Renderização
      </label>
      <div className="flex rounded-xl border border-white/[0.07] bg-white/[0.03] p-1">
        {(['opengl', 'vulkan'] as const).map((api) => (
          <button
            key={api}
            type="button"
            onClick={() => onChange(api)}
            className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-[0.14em] transition ${
              value === api
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/30 hover:text-white/60'
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
