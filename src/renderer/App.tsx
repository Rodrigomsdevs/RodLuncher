import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { GraphicsApi, InstallProgress, MinecraftVersion } from '../shared/types';
import GraphicsSelector from './components/GraphicsSelector';
import NicknameInput from './components/NicknameInput';
import PlayButton from './components/PlayButton';
import ProgressBar from './components/ProgressBar';
import SkinViewer3D from './components/SkinViewer3D';
import TitleBar from './components/TitleBar';
import VersionSelector from './components/VersionSelector';

const DEFAULT_SKIN_URL = 'https://minotar.net/skin/Steve';
const NICKNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

export default function App() {
  const [nickname, setNickname] = useState(
    () => localStorage.getItem('rodlauncher:nickname') ?? '',
  );
  const [graphicsApi, setGraphicsApi] = useState<GraphicsApi>(
    () => (localStorage.getItem('rodlauncher:graphics') as GraphicsApi | null) ?? 'opengl',
  );
  const [versions, setVersions] = useState<MinecraftVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [includeSnapshots, setIncludeSnapshots] = useState(false);
  const [customSkin, setCustomSkin] = useState<string | null>(null);
  const [progress, setProgress] = useState<InstallProgress>({
    phase: 'idle',
    status: '',
    percentage: 0,
  });
  const [installDir, setInstallDir] = useState('');
  const [isLoadingVersions, setIsLoadingVersions] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [gameRunning, setGameRunning] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const nicknameIsValid = NICKNAME_PATTERN.test(nickname);
  const selectedVersionInfo = versions.find((v) => v.id === selectedVersion);
  const skinUrl = useMemo(() => {
    if (customSkin) return customSkin;
    if (nicknameIsValid) return `https://minotar.net/skin/${encodeURIComponent(nickname)}`;
    return DEFAULT_SKIN_URL;
  }, [customSkin, nickname, nicknameIsValid]);

  useEffect(() => {
    const disposeProgress = window.rodlauncher.onInstallProgress(setProgress);
    const disposeGameClosed = window.rodlauncher.onGameClosed(() => {
      setGameRunning(false);
      setSuccess('Jogo encerrado. Pronto para jogar novamente.');
      void loadVersions();
    });
    return () => {
      disposeProgress();
      disposeGameClosed();
    };
  }, []);

  useEffect(() => {
    void loadVersions();
    void window.rodlauncher
      .getInstallDirectory()
      .then(setInstallDir)
      .catch(() => setInstallDir(''));
  }, []);

  async function loadVersions() {
    setIsLoadingVersions(true);
    try {
      const next = await window.rodlauncher.listVersions();
      setVersions(next);
      setSelectedVersion((cur) => {
        if (cur) return cur;
        return next.find((v) => v.type === 'release')?.id ?? '';
      });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsLoadingVersions(false);
    }
  }

  async function handlePlay() {
    setError('');
    setSuccess('');

    if (!nicknameIsValid) {
      setError('Use um nick com 3–16 caracteres: letras, números e underline.');
      return;
    }
    if (!selectedVersion) {
      setError('Escolha uma versão do Minecraft.');
      return;
    }

    setIsBusy(true);
    try {
      const result = await window.rodlauncher.launchGame({
        username: nickname,
        versionId: selectedVersion,
        graphicsApi,
        memory: { min: 512, max: 2048 },
      });
      setSuccess(result.message);
      setGameRunning(true);
      await loadVersions();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsBusy(false);
    }
  }

  const showProgress = isBusy && progress.phase !== 'idle';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#080d08] text-white">
      <TitleBar />

      <div className="relative flex min-h-0 flex-1">
        {/* Background */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_50%,rgba(90,158,75,0.06),transparent)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:repeating-linear-gradient(0deg,transparent,transparent_31px,rgba(255,255,255,0.6)_31px,rgba(255,255,255,0.6)_32px),repeating-linear-gradient(90deg,transparent,transparent_31px,rgba(255,255,255,0.6)_31px,rgba(255,255,255,0.6)_32px)]" />

        {/* Left panel */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative flex w-[400px] shrink-0 flex-col border-r border-white/[0.06] max-lg:w-full"
        >
          <div className="flex flex-1 flex-col overflow-y-auto p-6">
            {/* Header */}
            <div className="mb-7 flex items-start justify-between">
              <div>
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-[2px] bg-grass shadow-[0_0_8px_rgba(90,158,75,0.8)]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.26em] text-white/35">
                    Minecraft Java
                  </span>
                </div>
                <h1 className="text-4xl font-black tracking-tight text-white">
                  Rod
                  <span className="text-grass">Launcher</span>
                </h1>
              </div>

              <button
                type="button"
                onClick={() => void loadVersions()}
                disabled={isLoadingVersions || isBusy}
                className="mt-1 grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-white/30 transition hover:border-white/20 hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-30"
                title="Atualizar versões"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingVersions ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Form */}
            <div className="flex flex-col gap-4">
              <NicknameInput
                value={nickname}
                isValid={nicknameIsValid}
                onChange={(v) => {
                  setNickname(v);
                  localStorage.setItem('rodlauncher:nickname', v);
                }}
              />

              <VersionSelector
                versions={versions}
                selectedVersion={selectedVersion}
                includeSnapshots={includeSnapshots}
                isLoading={isLoadingVersions}
                onSelectVersion={setSelectedVersion}
                onToggleSnapshots={setIncludeSnapshots}
              />

              <GraphicsSelector
                value={graphicsApi}
                onChange={(v) => {
                  setGraphicsApi(v);
                  localStorage.setItem('rodlauncher:graphics', v);
                }}
              />

              <ProgressBar progress={progress} visible={showProgress} />

              {/* Feedback */}
              <AnimatePresence mode="wait">
                {error ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-start gap-2.5 rounded-xl border border-ember/25 bg-ember/[0.08] px-3.5 py-3"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ember/80" />
                    <p className="text-xs leading-relaxed text-white/70">{error}</p>
                  </motion.div>
                ) : success ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-center gap-2.5 rounded-xl border border-moss/25 bg-moss/[0.07] px-3.5 py-3"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-moss/80" />
                    <p className="text-xs text-white/70">{success}</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-white/[0.06] px-6 py-4">
            {installDir && (
              <div className="mb-3 flex items-center gap-1.5 min-w-0">
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-white/20" />
                <span className="truncate text-[11px] text-white/25">{installDir}</span>
              </div>
            )}
            <PlayButton
              disabled={!nicknameIsValid || !selectedVersion || isBusy || gameRunning}
              loading={isBusy}
              gameRunning={gameRunning}
              installed={Boolean(selectedVersionInfo?.installed)}
              onClick={() => void handlePlay()}
            />
          </div>
        </motion.div>

        {/* Right panel — skin viewer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative min-w-0 flex-1 p-6 max-lg:hidden"
        >
          <SkinViewer3D
            username={nicknameIsValid ? nickname : 'Steve'}
            skinUrl={skinUrl}
            hasCustomSkin={Boolean(customSkin)}
            onSkinLoaded={setCustomSkin}
            onResetSkin={() => setCustomSkin(null)}
          />
        </motion.div>
      </div>
    </div>
  );
}

function getErrorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  return String(e);
}
