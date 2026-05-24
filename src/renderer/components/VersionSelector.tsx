import { Check, ChevronDown, Package, Search } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { MinecraftVersion } from '../../shared/types';

interface VersionSelectorProps {
  versions: MinecraftVersion[];
  selectedVersion: string;
  includeSnapshots: boolean;
  isLoading: boolean;
  onSelectVersion: (versionId: string) => void;
  onToggleSnapshots: (include: boolean) => void;
}

export default function VersionSelector({
  versions,
  selectedVersion,
  includeSnapshots,
  isLoading,
  onSelectVersion,
  onToggleSnapshots,
}: VersionSelectorProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = versions.find((v) => v.id === selectedVersion);
  const filteredVersions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return versions
      .filter((v) => includeSnapshots || v.type === 'release')
      .filter((v) => v.type === 'release' || v.type === 'snapshot')
      .filter((v) => !q || v.id.toLowerCase().includes(q))
      .slice(0, 80);
  }, [includeSnapshots, query, versions]);

  function open() {
    setIsOpen(true);
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-gold/55">
          Versão
        </label>
        <button
          type="button"
          onClick={() => onToggleSnapshots(!includeSnapshots)}
          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
            includeSnapshots
              ? 'bg-gold/15 text-glow'
              : 'text-gold/35 hover:text-glow'
          }`}
        >
          Snapshots
        </button>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={isOpen ? () => setIsOpen(false) : open}
          disabled={isLoading}
          className="flex w-full items-center gap-3 rounded-xl border border-gold/10 bg-black/25 px-3.5 py-3 text-left transition hover:border-gold/25 hover:bg-gold/[0.04] disabled:cursor-wait disabled:opacity-60"
        >
          <Package className="h-4 w-4 shrink-0 text-gold/65" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">
              {isLoading ? 'Carregando...' : selected?.id ?? 'Selecione uma versão'}
            </div>
            {selected && (
              <div className="text-[11px] text-white/30">
                {selected.installed ? '● instalada' : selected.type}
              </div>
            )}
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-gold/35 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-gold/15 bg-[#050a03]/95 shadow-2xl shadow-black/70 backdrop-blur-xl">
              <div className="flex items-center gap-2 border-b border-gold/10 px-3 py-2">
                <Search className="h-3.5 w-3.5 text-gold/35" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar versão..."
                  className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gold/25"
                />
              </div>
              <div className="max-h-60 overflow-y-auto p-1.5">
                {filteredVersions.length === 0 ? (
                  <div className="py-6 text-center text-xs text-white/30">
                    Nenhuma versão encontrada.
                  </div>
                ) : (
                  filteredVersions.map((version) => (
                    <button
                      key={version.id}
                      type="button"
                      onClick={() => {
                        onSelectVersion(version.id);
                        setIsOpen(false);
                        setQuery('');
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition hover:bg-gold/[0.07]"
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-[2px] ${
                          version.type === 'release' ? 'bg-moss' : 'bg-gold'
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-white/90">
                          {version.id}
                        </span>
                        {version.installed && (
                          <span className="text-[11px] text-glow/70">instalada</span>
                        )}
                      </span>
                      {selectedVersion === version.id && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-glow" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
