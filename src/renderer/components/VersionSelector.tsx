import { Box, Check, ChevronDown, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
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

  const selected = versions.find((version) => version.id === selectedVersion);
  const selectedInstallLabel = selected?.installed ? getInstallLabel(selected.installedSource) : null;
  const filteredVersions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return versions
      .filter((version) => includeSnapshots || version.type === 'release')
      .filter((version) => version.type === 'release' || version.type === 'snapshot')
      .filter((version) => !normalizedQuery || version.id.toLowerCase().includes(normalizedQuery))
      .slice(0, 80);
  }, [includeSnapshots, query, versions]);

  return (
    <div className="relative">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-zinc-200">Versao</span>
        <button
          type="button"
          onClick={() => onToggleSnapshots(!includeSnapshots)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
            includeSnapshots
              ? 'border-moss/50 bg-moss/15 text-moss'
              : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white'
          }`}
        >
          Snapshots
        </button>
      </div>

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        disabled={isLoading}
        className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-left shadow-inner shadow-black/20 transition hover:border-moss/40 disabled:cursor-wait disabled:opacity-70"
      >
        <Box className="h-5 w-5 shrink-0 text-dirt" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-bold text-white">
            {isLoading ? 'Carregando versoes...' : selected?.id ?? 'Selecione uma versao'}
          </div>
          <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            {selectedInstallLabel ?? selected?.type ?? 'release'}
          </div>
        </div>
        <ChevronDown className={`h-5 w-5 text-zinc-500 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen ? (
        <div className="absolute z-20 mt-3 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#111916]/95 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar versao"
              className="h-9 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
            />
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {filteredVersions.map((version) => (
              <button
                type="button"
                key={version.id}
                onClick={() => {
                  onSelectVersion(version.id);
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/10"
              >
                <span
                  className={`h-2.5 w-2.5 rounded-[3px] ${
                    version.type === 'release' ? 'bg-moss' : 'bg-ember'
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-zinc-100">
                    {version.id}
                  </span>
                  <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                    {version.type}
                    {version.installed ? ` / ${getInstallLabel(version.installedSource)}` : ''}
                  </span>
                </span>
                {selectedVersion === version.id ? <Check className="h-4 w-4 text-moss" /> : null}
              </button>
            ))}

            {!filteredVersions.length ? (
              <div className="px-3 py-8 text-center text-sm text-zinc-500">
                Nenhuma versao encontrada.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getInstallLabel(source?: MinecraftVersion['installedSource']) {
  if (source === 'official') return 'instalada na .minecraft';
  if (source === 'custom') return 'instalada na pasta custom';
  return 'instalada no RodLauncher';
}
