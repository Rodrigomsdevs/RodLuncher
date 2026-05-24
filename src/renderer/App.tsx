import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, FolderOpen, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import NicknameInput from './components/NicknameInput';
import PlayButton from './components/PlayButton';
import ProgressBar from './components/ProgressBar';
import SkinViewer3D from './components/SkinViewer3D';
import TitleBar from './components/TitleBar';
import VersionSelector from './components/VersionSelector';
import type { InstallProgress, MinecraftVersion } from '../shared/types';

const DEFAULT_SKIN_URL = 'https://minotar.net/skin/Steve';
const NICKNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

export default function App() {
  const [nickname, setNickname] = useState('');
  const [versions, setVersions] = useState<MinecraftVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [includeSnapshots, setIncludeSnapshots] = useState(false);
  const [customSkin, setCustomSkin] = useState<string | null>(null);
  const [progress, setProgress] = useState<InstallProgress>({
    phase: 'idle',
    status: 'Pronto',
    percentage: 0,
  });
  const [installDir, setInstallDir] = useState('');
  const [isLoadingVersions, setIsLoadingVersions] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const nicknameIsValid = NICKNAME_PATTERN.test(nickname);
  const selectedVersionInfo = versions.find((version) => version.id === selectedVersion);

  const skinUrl = useMemo(() => {
    if (customSkin) return customSkin;
    if (nicknameIsValid) return `https://minotar.net/skin/${encodeURIComponent(nickname)}`;
    return DEFAULT_SKIN_URL;
  }, [customSkin, nickname, nicknameIsValid]);

  useEffect(() => {
    const dispose = window.rodlauncher.onInstallProgress((nextProgress) => {
      setProgress(nextProgress);
    });

    return dispose;
  }, []);

  useEffect(() => {
    void loadVersions();
    void window.rodlauncher.getInstallDirectory().then(setInstallDir).catch(() => setInstallDir(''));
  }, []);

  async function loadVersions() {
    setIsLoadingVersions(true);
    setError('');

    try {
      const nextVersions = await window.rodlauncher.listVersions();
      setVersions(nextVersions);
      setSelectedVersion((current) => {
        if (current) return current;
        return nextVersions.find((version) => version.type === 'release')?.id ?? '';
      });
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsLoadingVersions(false);
    }
  }

  async function handlePlay() {
    setError('');
    setSuccess('');

    if (!nicknameIsValid) {
      setError('Use um nick com 3 a 16 caracteres, somente letras, numeros e underline.');
      return;
    }

    if (!selectedVersion) {
      setError('Escolha uma versao do Minecraft.');
      return;
    }

    setIsBusy(true);

    try {
      if (!selectedVersionInfo?.installed) {
        await window.rodlauncher.installVersion(selectedVersion);
      }

      const result = await window.rodlauncher.launchGame({
        username: nickname,
        versionId: selectedVersion,
        memory: {
          min: 512,
          max: 2048,
        },
      });

      setSuccess(result.message);
      await loadVersions();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-night text-zinc-100">
      <TitleBar />

      <main className="relative min-h-[calc(100vh-40px)] px-6 pb-6 pt-4">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,#0D1117_0%,#142014_42%,#21180f_100%)]" />
        <div className="absolute inset-0 -z-10 opacity-[0.13] [background-image:linear-gradient(90deg,rgba(255,255,255,.16)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.14)_1px,transparent_1px)] [background-size:34px_34px]" />

        <section className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_390px] gap-5 max-lg:grid-cols-1">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="rounded-[28px] border border-white/10 bg-white/[0.055] p-7 shadow-2xl shadow-black/30 backdrop-blur-2xl"
          >
            <header className="mb-8 flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-moss">
                  <span className="h-2 w-2 rounded-sm bg-moss shadow-[0_0_18px_rgba(141,211,107,.8)]" />
                  Minecraft Java
                </div>
                <h1 className="text-5xl font-black tracking-normal text-white max-sm:text-4xl">
                  Rod<span className="bg-gradient-to-r from-moss via-grass to-[#E6B86A] bg-clip-text text-transparent">Launcher</span>
                </h1>
              </div>

              <button
                type="button"
                onClick={loadVersions}
                disabled={isLoadingVersions || isBusy}
                className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/10 text-zinc-200 transition hover:border-moss/40 hover:text-moss disabled:cursor-not-allowed disabled:opacity-50"
                title="Atualizar versoes"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingVersions ? 'animate-spin' : ''}`} />
              </button>
            </header>

            <div className="grid gap-5">
              <NicknameInput value={nickname} onChange={setNickname} isValid={nicknameIsValid} />

              <VersionSelector
                versions={versions}
                selectedVersion={selectedVersion}
                includeSnapshots={includeSnapshots}
                isLoading={isLoadingVersions}
                onSelectVersion={setSelectedVersion}
                onToggleSnapshots={setIncludeSnapshots}
              />

              <ProgressBar progress={progress} visible={isBusy || progress.phase !== 'idle'} />

              <AnimatePresence mode="wait">
                {error ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex items-center gap-3 rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-sm text-red-100"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 text-ember" />
                    <span>{error}</span>
                  </motion.div>
                ) : success ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex items-center gap-3 rounded-2xl border border-moss/40 bg-moss/10 px-4 py-3 text-sm text-green-100"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-moss" />
                    <span>{success}</span>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="flex items-center justify-between gap-4 pt-2 max-sm:flex-col max-sm:items-stretch">
                <div className="min-w-0 text-xs text-zinc-400">
                  <div className="mb-1 flex items-center gap-2 text-zinc-300">
                    <FolderOpen className="h-3.5 w-3.5 text-moss" />
                    <span className="font-medium">Instancia local</span>
                  </div>
                  <p className="truncate">{installDir || 'Carregando pasta...'}</p>
                </div>

                <PlayButton
                  disabled={!nicknameIsValid || !selectedVersion || isBusy}
                  loading={isBusy}
                  installed={Boolean(selectedVersionInfo?.installed)}
                  onClick={handlePlay}
                />
              </div>
            </div>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.06, ease: 'easeOut' }}
            className="rounded-[28px] border border-white/10 bg-black/20 p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl"
          >
            <SkinViewer3D
              username={nicknameIsValid ? nickname : 'Steve'}
              skinUrl={skinUrl}
              hasCustomSkin={Boolean(customSkin)}
              onSkinLoaded={setCustomSkin}
              onResetSkin={() => setCustomSkin(null)}
            />
          </motion.aside>
        </section>
      </main>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}
