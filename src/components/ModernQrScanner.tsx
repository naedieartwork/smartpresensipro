import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, RefreshCw, CheckCircle2, AlertCircle, QrCode } from 'lucide-react';
import jsQR from 'jsqr';
import { sound } from '../utils/audio';

interface ModernQrScannerProps {
  onScan: (decodedText: string) => void;
  isActive: boolean;
  onToggleActive: (active: boolean) => void;
}

export const ModernQrScanner: React.FC<ModernQrScannerProps> = ({
  onScan,
  isActive,
  onToggleActive,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSuccessCode, setLastSuccessCode] = useState<string | null>(null);
  const [isScanningSuccess, setIsScanningSuccess] = useState<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);
  const scanningRef = useRef<boolean>(false);

  const stopCameraStream = useCallback(() => {
    scanningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCameraStream = useCallback(async () => {
    setErrorMsg(null);
    try {
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        scanningRef.current = true;
        requestAnimationFrame(scanTick);
      }
      onToggleActive(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('getUserMedia error:', msg);
      setErrorMsg('Gagal mengakses kamera: ' + msg);
      onToggleActive(false);
    }
  }, [onToggleActive]);

  const scanTick = () => {
    if (!scanningRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          const scannedText = code.data.trim();
          if (scannedText && !isScanningSuccess) {
            setIsScanningSuccess(true);
            setLastSuccessCode(scannedText);
            sound.playSuccess();
            onScan(scannedText);

            setTimeout(() => {
              setIsScanningSuccess(false);
            }, 2500);
          }
        }
      }
    }

    if (scanningRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanTick);
    }
  };

  useEffect(() => {
    if (isActive) {
      startCameraStream();
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [isActive, startCameraStream, stopCameraStream]);

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 relative overflow-hidden space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-500 flex items-center justify-center text-white shadow-sm shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 whitespace-nowrap">
              Modern QR Camera Scanner
            </h3>
            <p className="text-xs text-gray-500">
              Pindai QR Code kartu presensi dengan umpan balik visual instan
            </p>
          </div>
        </div>

        {/* Toggle Button (Hanya tampil saat kamera aktif untuk mematikan kamera) */}
        {isActive && (
          <button
            type="button"
            onClick={() => onToggleActive(false)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm self-start sm:self-auto"
          >
            <CameraOff className="w-3.5 h-3.5" />
            <span>Matikan Kamera</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2 font-mono">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Viewport & HUD Overlay */}
      <div
        className={`relative rounded-2xl overflow-hidden bg-gray-900 border transition-all duration-300 min-h-[260px] flex items-center justify-center ${
          isScanningSuccess
            ? 'border-cyan-500 shadow-[0_0_25px_rgba(6,182,212,0.4)]'
            : 'border-gray-200'
        }`}
      >
        <video
          ref={videoRef}
          className={`w-full h-full object-cover max-h-[300px] ${isActive ? 'block' : 'hidden'}`}
          muted
          playsInline
        ></video>
        <canvas ref={canvasRef} className="hidden"></canvas>

        {isActive && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-4">
            <div className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md border border-cyan-200 text-[10px] font-mono text-cyan-800 flex items-center gap-2 shadow-sm font-semibold">
              <span className={`w-2 h-2 rounded-full ${isScanningSuccess ? 'bg-cyan-500 animate-ping' : 'bg-cyan-500 animate-pulse'}`}></span>
              <span>{isScanningSuccess ? 'QR Berhasil Dideteksi!' : 'Arahkan QR Code ke Kotak Scanner'}</span>
            </div>

            <div className="relative w-48 h-48 sm:w-56 sm:h-56 border-2 border-cyan-400 rounded-2xl overflow-hidden shadow-[inset_0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400"></div>
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400"></div>
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400"></div>
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400"></div>

              {!isScanningSuccess && (
                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-bounce shadow-[0_0_10px_#06b6d4]"></div>
              )}

              {isScanningSuccess && (
                <div className="absolute inset-0 bg-cyan-500/30 backdrop-blur-[2px] flex flex-col items-center justify-center animate-in zoom-in duration-200">
                  <div className="w-14 h-14 rounded-full bg-cyan-500 text-white flex items-center justify-center shadow-lg animate-bounce">
                    <CheckCircle2 className="w-8 h-8 text-white" />
                  </div>
                  <span className="mt-2 text-xs font-bold text-gray-900 bg-white px-3 py-1 rounded-full font-mono border border-cyan-200 shadow-sm">
                    {lastSuccessCode}
                  </span>
                </div>
              )}
            </div>

            <div className="text-[10px] font-mono text-white bg-black/60 px-3 py-1 rounded-lg backdrop-blur-sm">
              Real-time MediaStream API & jsQR Decoder
            </div>
          </div>
        )}

        {/* Inactive Placeholder */}
        {!isActive && (
          <div className="absolute inset-0 bg-cyan-50/90 border border-cyan-200 text-center p-6 flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-cyan-200 flex items-center justify-center text-cyan-600 shadow-sm">
              <QrCode className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-900">Kamera Scanner Sedang Nonaktif</h4>
              <p className="text-[11px] text-gray-600 mt-0.5 max-w-xs mx-auto">
                Klik tombol di bawah untuk memindai kartu QR Code secara instan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onToggleActive(true)}
              className="inline-flex items-center gap-1.5 text-xs text-white font-semibold bg-cyan-500 hover:bg-cyan-600 px-4 py-2 rounded-xl transition shadow-sm"
            >
              <Camera className="w-3.5 h-3.5 text-white" />
              Nyalakan Pemindai QR
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
