import { RotateCcw, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SkinViewer, WalkingAnimation } from 'skinview3d';

interface SkinViewer3DProps {
  username: string;
  skinUrl: string;
  hasCustomSkin: boolean;
  onSkinLoaded: (skinUrl: string) => void;
  onResetSkin: () => void;
}

export default function SkinViewer3D({
  username,
  skinUrl,
  hasCustomSkin,
  onSkinLoaded,
  onResetSkin,
}: SkinViewer3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<SkinViewer | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [skinError, setSkinError] = useState('');

  useEffect(() => {
    if (!canvasRef.current) return undefined;

    const viewer = new SkinViewer({
      canvas: canvasRef.current,
      width: 340,
      height: 460,
      skin: skinUrl,
    });

    viewerRef.current = viewer;
    viewer.animation = new WalkingAnimation();
    viewer.animation.speed = 0.58;
    viewer.controls.enableRotate = true;
    viewer.controls.enableZoom = false;
    viewer.autoRotate = true;
    viewer.autoRotateSpeed = 0.55;
    viewer.camera.position.set(0, 18, 42);
    viewer.camera.rotation.x = -0.08;
    viewer.globalLight.intensity = 0.72;
    viewer.cameraLight.intensity = 0.9;

    return () => {
      viewer.dispose();
      viewerRef.current = null;
    };
  }, [skinUrl]);

  function handleSkinFile(file?: File) {
    setSkinError('');

    if (!file) return;

    if (file.type !== 'image/png') {
      setSkinError('Escolha uma skin PNG.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onSkinLoaded(reader.result);
      }
    };
    reader.onerror = () => setSkinError('Nao foi possivel carregar a skin.');
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex h-full min-h-[620px] flex-col max-lg:min-h-[560px]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-moss">Skin</div>
          <h2 className="truncate text-2xl font-black text-white">{username}</h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/10 text-zinc-200 transition hover:border-moss/50 hover:text-moss"
            title="Carregar skin"
          >
            <Upload className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onResetSkin}
            disabled={!hasCustomSkin}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/10 text-zinc-200 transition hover:border-dirt/60 hover:text-[#E6B86A] disabled:cursor-not-allowed disabled:opacity-40"
            title="Restaurar skin"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative grid flex-1 place-items-center overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(90,158,75,.18),transparent_58%),linear-gradient(180deg,rgba(255,255,255,.07),rgba(0,0,0,.1))]">
        <canvas ref={canvasRef} className="h-full max-h-[460px] w-full max-w-[340px]" />
        <div className="pointer-events-none absolute bottom-7 h-7 w-40 rounded-[50%] bg-black/35 blur-md" />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png"
        className="hidden"
        onChange={(event) => handleSkinFile(event.target.files?.[0])}
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Origem</div>
          <div className="truncate text-sm font-semibold text-zinc-100">
            {hasCustomSkin ? 'Arquivo local' : 'Minotar / Steve'}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Modelo</div>
          <div className="text-sm font-semibold text-zinc-100">3D interativo</div>
        </div>
      </div>

      <div className="mt-2 h-4 text-xs text-ember">{skinError}</div>
    </div>
  );
}
