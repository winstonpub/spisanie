import { useEffect, useRef, useState } from "react";
import { BarcodeFormat, BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType } from "@zxing/library";
import type { IScannerControls } from "@zxing/browser";
import { CameraIcon, XIcon } from "./icons";

interface BarcodeScannerModalProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

type ScannerStatus = "starting" | "scanning" | "detected" | "error";

const FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR,
];

function cameraError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Нет доступа к камере. Разрешите использование камеры в настройках браузера.";
    }
    if (error.name === "NotFoundError") return "Камера не найдена на этом устройстве.";
    if (error.name === "NotReadableError") return "Камера уже используется другим приложением.";
  }
  return "Не удалось открыть камеру. Проверьте разрешения и повторите попытку.";
}

/** Модальное окно с камерой для считывания товарных штрихкодов */
export default function BarcodeScannerModal({ onDetected, onClose }: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const detectedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  const [status, setStatus] = useState<ScannerStatus>("starting");
  const [error, setError] = useState<string | null>(null);

  // Не перезапускаем поток камеры из-за нового рендера родительского компонента.
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let cancelled = false;
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 150,
      delayBetweenScanSuccess: 1000,
    });

    const stopStream = () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
      const stream = videoRef.current?.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) {
        setError("Сканирование камерой не поддерживается этим браузером.");
        setStatus("error");
        return;
      }

      try {
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current,
          (result) => {
            if (!result || detectedRef.current || cancelled) return;
            detectedRef.current = true;
            setStatus("detected");
            stopStream();
            onDetectedRef.current(result.getText());
          }
        );
        if (cancelled) controls.stop();
        else {
          controlsRef.current = controls;
          setStatus("scanning");
        }
      } catch (scanError) {
        if (!cancelled) {
          setError(cameraError(scanError));
          setStatus("error");
        }
      }
    };

    void start();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-scanner-title"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
              <CameraIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 id="barcode-scanner-title" className="font-semibold text-slate-900">
                Сканирование штрихкода
              </h2>
              <p className="text-xs text-slate-500">Наведите камеру на штрихкод товара</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть камеру"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="relative aspect-[4/3] bg-slate-950">
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
          {status !== "error" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
              <div className="relative h-32 w-full max-w-sm rounded-xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(15,23,42,0.32)]">
                <span className="absolute left-3 right-3 top-1/2 h-0.5 -translate-y-1/2 bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,0.8)]" />
              </div>
            </div>
          )}
          {status === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 text-sm font-medium text-white">
              Подключаем камеру…
            </div>
          )}
          {status === "detected" && (
            <div className="absolute inset-0 flex items-center justify-center bg-emerald-950/50 text-sm font-medium text-white">
              Штрихкод считан
            </div>
          )}
          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center text-white">
              <CameraIcon className="h-9 w-9 text-slate-300" />
              <p className="max-w-sm text-sm leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
              >
                Закрыть
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 px-5 py-3 text-xs leading-relaxed text-slate-500">
          Камера работает только при доступе по HTTPS или на localhost. На телефоне обычно включается задняя камера.
        </div>
      </div>
    </div>
  );
}