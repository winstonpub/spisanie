import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { writeCatalogStep } from "../lib/catalog";
import type { ProductOperation } from "../lib/catalog";
import type { Product } from "../lib/sheet";
import BarcodeScannerModal from "./BarcodeScannerModal";
import { AlertIcon, CameraIcon, PlusIcon, SpinnerIcon, XIcon } from "./icons";

interface NewProductModalProps {
  sku: string;
  categoryTitle: string;
  catalogUrl: string;
  scriptUrl: string;
  onComplete: (product: Product) => void;
  onClose: () => void;
}

type Step = "offer" | "barcode" | "name";

function operationId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function NewProductModal({ sku, categoryTitle, catalogUrl, scriptUrl, onComplete, onClose }: NewProductModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const operation = useRef<ProductOperation | null>(null);
  if (!operation.current) operation.current = { operationId: operationId(), sku, catalogUrl, scriptUrl };
  const attemptedRef = useRef(false);
  const busyRef = useRef(false);
  const mountedRef = useRef(false);
  const [step, setStep] = useState<Step>("offer");
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelFailed, setCancelFailed] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      mountedRef.current = false;
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (!cameraOpen) dialogRef.current?.querySelector<HTMLElement>("[data-step-focus]")?.focus();
  }, [step, cameraOpen]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busyRef.current) return;
    if (step === "barcode" && (!barcode.trim() || !/^[\x20-\x7e]+$/.test(barcode.trim()))) {
      setError("Введите штрихкод: цифры или латинские символы.");
      return;
    }
    if (step === "name" && !name.trim()) {
      setError("Введите название товара.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setCancelFailed(false);
    try {
      attemptedRef.current = true;
      const result = await writeCatalogStep(
        operation.current!,
        step === "offer" ? "product.begin" : step === "barcode" ? "product.barcode" : "product.name",
        step === "barcode" ? { barcode: barcode.trim() } : step === "name" ? { name: name.trim() } : {},
      );
      if (!mountedRef.current) return;
      if (result.status === "complete") {
        onComplete(result.product);
        return;
      }
      if (step === "offer") {
        setBarcode(result.product.barcode);
        setStep(result.product.barcode ? "name" : "barcode");
      } else if (step === "barcode") {
        setBarcode(result.product.barcode);
        setStep("name");
      }
    } catch (failure) {
      if (mountedRef.current) setError(failure instanceof Error ? failure.message : "Не удалось сохранить товар.");
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  const close = async () => {
    if (busyRef.current) return;
    if (cameraOpen) {
      setCameraOpen(false);
      return;
    }
    if (!attemptedRef.current) {
      onClose();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await writeCatalogStep(operation.current!, "product.cancel");
      if (!mountedRef.current) return;
      if (result.status === "complete") onComplete(result.product);
      else onClose();
    } catch (failure) {
      if (!mountedRef.current) return;
      const reason = failure instanceof Error ? failure.message : "Ошибка сети.";
      setError(`Не удалось подтвердить отмену. ${reason} Уже записанные поля могут остаться в базе.`);
      setCancelFailed(true);
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  const title = step === "offer"
    ? "Данного артикула нет в базе"
    : step === "barcode"
      ? "Отсканируйте товар или введите штрихкод"
      : "Введите название товара (желательно скопировать название из платформы)";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="new-product-title"
      className="new-product-dialog m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl print:hidden"
      onCancel={(event) => { event.preventDefault(); void close(); }}
    >
      <div aria-hidden={cameraOpen || undefined} inert={cameraOpen || undefined} className="max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <span className="text-sm font-medium text-slate-500">Новый товар</span>
          <button
            type="button"
            onClick={() => void close()}
            disabled={busy}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Закрыть <XIcon className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-5 p-5 sm:p-6" aria-busy={busy}>
          <div>
            <p className="mb-2 text-xs text-slate-500">{categoryTitle}</p>
            <h2 id="new-product-title" className="text-xl font-semibold leading-snug tracking-tight">{title}</h2>
            <p className="mt-3 break-all text-sm text-slate-600">Артикул: <strong className="font-mono font-semibold text-slate-900">{sku}</strong></p>
          </div>

          {step === "offer" && <p className="text-base text-slate-700">Добавить новый?</p>}

          {step === "barcode" && (
            <div className="space-y-3">
              <div>
                <label htmlFor="new-product-barcode" className="block text-sm font-medium">Штрихкод</label>
                <input
                  id="new-product-barcode"
                  data-step-focus
                  value={barcode}
                  onChange={(event) => { setBarcode(event.target.value); setError(null); }}
                  disabled={busy}
                  maxLength={128}
                  autoComplete="off"
                  spellCheck={false}
                  required
                  className="mt-1.5 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-base outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setCameraOpen(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium transition hover:bg-slate-50 disabled:opacity-50"
              >
                <CameraIcon className="h-4 w-4" /> Открыть камеру
              </button>
            </div>
          )}

          {step === "name" && (
            <div>
              <p className="mb-3 break-all text-sm text-slate-500">Штрихкод: <span className="font-mono">{barcode}</span></p>
              <div>
                <label htmlFor="new-product-name" className="block text-sm font-medium">Наименование</label>
                <textarea
                  id="new-product-name"
                  data-step-focus
                  value={name}
                  onChange={(event) => { setName(event.target.value); setError(null); }}
                  disabled={busy}
                  maxLength={2000}
                  rows={3}
                  required
                  className="mt-1.5 w-full min-w-0 resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
                />
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="flex items-start gap-2 break-words text-sm leading-relaxed text-rose-700">
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
            </p>
          )}
          {cancelFailed && (
            <button type="button" onClick={onClose} className="text-sm text-slate-600 underline underline-offset-2">
              Закрыть без удаления черновика
            </button>
          )}
          <button
            data-step-focus={step === "offer" ? "" : undefined}
            type="submit"
            disabled={busy}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {busy ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : step === "offer" ? <PlusIcon className="h-4 w-4" /> : null}
            {busy ? "Сохранение…" : step === "offer" ? "Добавить" : "Подтвердить"}
          </button>
          {step !== "offer" && (
            <p className="text-xs leading-relaxed text-slate-500">Поля сохраняются по шагам. «Закрыть» отменяет добавление и удаляет незавершённую запись.</p>
          )}
        </form>
      </div>
      {cameraOpen && (
        <BarcodeScannerModal
          onClose={() => setCameraOpen(false)}
          onDetected={(value) => { setBarcode(value); setError(null); setCameraOpen(false); }}
        />
      )}
    </dialog>
  );
}