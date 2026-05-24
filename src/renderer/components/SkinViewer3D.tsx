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
    <div className="flex h-full min-h-[620px] flex-col max-lg:min-h-[520px]">
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

      <div className="relative grid flex-1 place-items-center overflow-visible">
        <div className="pointer-events-none absolute h-[78%] w-[82%] rounded-full bg-moss/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-12 h-28 w-56 rounded-full bg-black/35 blur-2xl" />
        <canvas ref={canvasRef} className="relative z-10 h-full max-h-[460px] w-full max-w-[340px]" />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png"
        className="hidden"
        onChange={(event) => handleSkinFile(event.target.files?.[0])}
      />

      <div className="mt-3 h-4 text-xs text-ember">{skinError}</div>
    </div>
  );
}
