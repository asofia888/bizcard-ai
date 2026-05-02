import React, { useEffect, useRef, useState } from 'react';
import type { Corners } from '../../utils/perspectiveTransform';

interface Props {
  imageDataUri: string;
  onApply: (corners: Corners) => void;
  onSkip: () => void;
  onCancel: () => void;
}

type CornerKey = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';
const ORDER: CornerKey[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];

const DEFAULT_CORNERS: Corners = {
  topLeft:     { x: 0.05, y: 0.05 },
  topRight:    { x: 0.95, y: 0.05 },
  bottomRight: { x: 0.95, y: 0.95 },
  bottomLeft:  { x: 0.05, y: 0.95 },
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const CornerAdjustView: React.FC<Props> = ({ imageDataUri, onApply, onSkip, onCancel }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [corners, setCorners] = useState<Corners>(DEFAULT_CORNERS);
  const [dragging, setDragging] = useState<CornerKey | null>(null);
  const [imgAspect, setImgAspect] = useState<number | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImgAspect(img.width / img.height);
    img.src = imageDataUri;
  }, [imageDataUri]);

  const updateCorner = (key: CornerKey, clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clamp01((clientX - rect.left) / rect.width);
    const y = clamp01((clientY - rect.top) / rect.height);
    setCorners(prev => ({ ...prev, [key]: { x, y } }));
  };

  const onPointerDown = (key: CornerKey) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(key);
    updateCorner(key, e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    updateCorner(dragging, e.clientX, e.clientY);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(null);
  };

  const points = ORDER.map(k => `${corners[k].x * 100},${corners[k].y * 100}`).join(' ');

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* ヘッダー */}
      <div
        className="bg-slate-900/95 text-white flex items-center justify-between px-4 py-3 z-10"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <button
          onClick={onCancel}
          className="text-sm px-3 py-1.5 rounded hover:bg-white/10"
          aria-label="撮影し直す"
        >
          撮り直す
        </button>
        <span className="text-sm font-medium">名刺の四隅を合わせる</span>
        <button
          onClick={() => onApply(corners)}
          className="text-sm font-bold text-brand-300 px-3 py-1.5 rounded hover:bg-white/10"
        >
          確定
        </button>
      </div>

      {/* 画像と調整UI */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div
          ref={containerRef}
          className="relative max-w-full max-h-full"
          style={{
            aspectRatio: imgAspect ?? undefined,
            width: imgAspect ? '100%' : undefined,
          }}
        >
          <img
            src={imageDataUri}
            alt="撮影した名刺"
            className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
          />

          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <polygon
              points={points}
              fill="rgba(14, 76, 183, 0.18)"
              stroke="white"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {ORDER.map(key => (
            <button
              key={key}
              type="button"
              onPointerDown={onPointerDown(key)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              aria-label={`${key} ハンドル`}
              className={`absolute w-11 h-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-brand-500/70 active:bg-brand-500 transition-transform ${
                dragging === key ? 'scale-125 bg-brand-500' : ''
              }`}
              style={{
                left: `${corners[key].x * 100}%`,
                top: `${corners[key].y * 100}%`,
                touchAction: 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* フッター: ヒントとスキップボタン */}
      <div
        className="bg-slate-900/95 text-white px-4 py-3 flex flex-col items-center gap-2"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <p className="text-xs text-white/70 text-center">
          各ハンドルをドラッグして名刺の角に合わせてください
        </p>
        <button
          onClick={onSkip}
          className="text-xs text-white/60 underline px-2 py-1"
        >
          補正せずに進む
        </button>
      </div>
    </div>
  );
};
