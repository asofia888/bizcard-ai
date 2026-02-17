import React, { useRef, useState, useEffect } from 'react';
import { CameraIcon, XIcon, UploadIcon } from './Icons';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Prefer back camera
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsStreaming(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("カメラにアクセスできませんでした。権限を確認してください。");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(imageData);
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64String = reader.result as string;
              onCapture(base64String);
          };
          reader.readAsDataURL(file);
      }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-center items-center">
      <button 
        onClick={onClose} 
        className="absolute top-4 right-4 text-white bg-black/50 p-2 rounded-full z-10 hover:bg-black/70"
      >
        <XIcon className="w-8 h-8" />
      </button>

      {error ? (
        <div className="text-white p-6 text-center">
          <p className="mb-4 text-lg">{error}</p>
          <label className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full cursor-pointer flex items-center justify-center gap-2">
             <UploadIcon className="w-5 h-5"/>
             <span>代わりに画像をアップロード</span>
             <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      ) : (
        <>
          <div className="relative w-full h-full flex items-center justify-center bg-black">
             <video 
               ref={videoRef} 
               className="w-full h-full object-cover" 
               playsInline 
               muted 
             />
             <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none flex items-center justify-center">
                <div className="border-2 border-white/50 w-full h-2/3 rounded-lg"></div>
             </div>
          </div>
          
          <div className="absolute bottom-8 flex gap-8 items-center">
            
            <label className="text-white flex flex-col items-center gap-1 cursor-pointer opacity-80 hover:opacity-100">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-slate-600">
                    <UploadIcon className="w-6 h-6"/>
                </div>
                <span className="text-xs">写真選択</span>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>

            <button 
              onClick={takePhoto} 
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:bg-white/40 transition-all"
            >
              <div className="w-16 h-16 bg-white rounded-full"></div>
            </button>
            
            <div className="w-12"></div> {/* Spacer to center the capture button */}
          </div>
        </>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};