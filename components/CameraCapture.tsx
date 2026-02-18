import React, { useRef, useState, useEffect } from 'react';
import { XIcon, UploadIcon } from './Icons';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

const MAX_DIMENSION = 1500;
const JPEG_QUALITY = 0.82;
// 日本の名刺標準サイズ: 91mm × 55mm
const CARD_ASPECT = 91 / 55;

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      setError(null);
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('カメラにアクセスできませんでした。権限を確認してください。');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
      setVideoReady(false);
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const guide = guideRef.current;
    if (!video || !canvas || !guide) return;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 表示サイズ vs 実際の動画解像度
    const screenW = video.clientWidth;
    const screenH = video.clientHeight;
    const videoW = video.videoWidth;
    const videoH = video.videoHeight;

    // object-cover のスケール係数
    const scale = Math.max(screenW / videoW, screenH / videoH);

    // 動画が画面からはみ出すオフセット
    const offsetX = (videoW * scale - screenW) / 2;
    const offsetY = (videoH * scale - screenH) / 2;

    // ガイド枠のビューポート座標
    const rect = guide.getBoundingClientRect();

    // ガイド枠 → 動画ピクセル座標に変換
    const cropX = Math.max(0, Math.round((rect.left + offsetX) / scale));
    const cropY = Math.max(0, Math.round((rect.top + offsetY) / scale));
    const cropW = Math.min(videoW - cropX, Math.round(rect.width / scale));
    const cropH = Math.min(videoH - cropY, Math.round(rect.height / scale));

    // 出力サイズ（MAX_DIMENSION に合わせてリサイズ）
    const outScale = Math.min(1, MAX_DIMENSION / Math.max(cropW, cropH));
    canvas.width = Math.round(cropW * outScale);
    canvas.height = Math.round(cropH * outScale);

    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const original = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        const ctx2 = c.getContext('2d');
        if (ctx2) {
          ctx2.drawImage(img, 0, 0, c.width, c.height);
          onCapture(c.toDataURL('image/jpeg', JPEG_QUALITY));
        } else {
          onCapture(original);
        }
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* 閉じるボタン */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white bg-black/50 p-2 rounded-full z-20 hover:bg-black/70"
      >
        <XIcon className="w-8 h-8" />
      </button>

      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white p-6 text-center gap-4">
          <p className="text-lg">{error}</p>
          <label className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full cursor-pointer flex items-center gap-2">
            <UploadIcon className="w-5 h-5" />
            <span>画像をアップロード</span>
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      ) : (
        <>
          {/* カメラ映像（フルスクリーン） */}
          <div className="absolute inset-0">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              onLoadedMetadata={() => setVideoReady(true)}
            />
          </div>

          {/* 名刺ガイドオーバーレイ */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {/* 名刺比率ガイド枠（box-shadow で周囲を暗くする） */}
            <div
              ref={guideRef}
              className="w-5/6"
              style={{
                aspectRatio: String(CARD_ASPECT),
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.58)',
                borderRadius: '6px',
                position: 'relative',
              }}
            >
              {/* 四隅のコーナーマーカー */}
              <span className="absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] border-white rounded-tl-md" />
              <span className="absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] border-white rounded-tr-md" />
              <span className="absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] border-white rounded-bl-md" />
              <span className="absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] border-white rounded-br-md" />
            </div>

            <p className="text-white/75 text-xs mt-5 tracking-widest">
              名刺をガイドに合わせて撮影
            </p>
          </div>

          {/* 撮影ボタン・写真選択ボタン */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-12 z-10">
            <label className="text-white flex flex-col items-center gap-1.5 cursor-pointer opacity-80 hover:opacity-100 pointer-events-auto">
              <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center border border-slate-600">
                <UploadIcon className="w-6 h-6" />
              </div>
              <span className="text-xs">写真選択</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>

            <button
              onClick={takePhoto}
              disabled={!videoReady}
              className="pointer-events-auto w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:bg-white/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="w-16 h-16 bg-white rounded-full" />
            </button>

            {/* センタリング用スペーサー */}
            <div className="w-12" />
          </div>
        </>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
