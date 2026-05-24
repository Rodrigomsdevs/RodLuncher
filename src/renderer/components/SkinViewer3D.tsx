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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<SkinViewer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [skinError, setSkinError] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { clientWidth: w, clientHeight: h } = container;

    const viewer = new SkinViewer({
      canvas,
      width: Math.max(w, 80),
      height: Math.max(h, 80),
      skin: skinUrl,
    });

    viewerRef.current = viewer;
    viewer.animation = new WalkingAnimation();
    viewer.animation.speed = 0.55;
    viewer.controls.enableRotate = true;
    viewer.controls.enableZoom = false;
    viewer.autoRotate = true;
    viewer.autoRotateSpeed = 0.5;
    viewer.camera.position.set(0, 18, 42);
    viewer.camera.rotation.x = -0.08;
    viewer.globalLight.intensity = 0.7;
    viewer.cameraLight.intensity = 0.85;

    const observer = new ResizeObserver(() => {
      const { clientWidth: nw, clientHeight: nh } = container;
      if (nw > 0 && nh > 0) viewer.setSize(nw, nh);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      viewer.dispose();
      viewerRef.current = null;
    };
  }, [skinUrl]);

  function handleFile(file?: File) {
    setSkinError('');
    if (!file) return;
    if (file.type !== 'image/png') {
      setSkinError('Use uma skin em PNG.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onSkinLoaded(reader.result);
    };
    reader.onerror = () => setSkinError('Não foi possível carregar a skin.');
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Skin</p>
          <h2 className="truncate text-lg font-black text-white">{username}</h2>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.04] text-white/40 transition hover:border-white/20 hover:text-white/80"
            title="Carregar skin"
          >
            <Upload className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onResetSkin}
            disabled={!hasCustomSkin}
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.04] text-white/40 transition hover:border-white/20 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-30"
            title="Restaurar skin"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-2/3 w-1/2 rounded-full bg-moss/10 blur-3xl" />
        </div>
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {skinError && (
        <p className="mt-2 shrink-0 text-[11px] text-ember/80">{skinError}</p>
      )}
    </div>
  );
}
