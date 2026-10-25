import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeProps {
  value: string;
  height?: number;
  className?: string;
}

/** Проверка контрольной цифры GTIN (EAN-8, UPC-A, EAN-13) */
function isValidGtin(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  const digits = value.split("").map(Number);
  const check = digits.pop()!;
  let sum = 0;
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += digits[i] * w;
  return (10 - (sum % 10)) % 10 === check;
}

function detectFormat(value: string): string {
  if (isValidGtin(value)) {
    if (value.length === 13) return "EAN13";
    if (value.length === 8) return "EAN8";
    if (value.length === 12) return "UPC";
  }
  return "CODE128";
}

export default function Barcode({ value, height = 48, className }: BarcodeProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    svg.innerHTML = "";
    setError(null);
    if (!value) return;

    const format = detectFormat(value);
    try {
      JsBarcode(svg, value, {
        format,
        height,
        width: 1.6,
        margin: 4,
        fontSize: 13,
        font: "ui-monospace, SFMono-Regular, Menlo, monospace",
        textMargin: 2,
        background: "transparent",
        lineColor: "#0f172a",
        displayValue: true,
        flat: format === "CODE128",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось построить штрихкод");
    }
  }, [value, height]);

  if (!value) return null;

  return (
    <div className={className}>
      <svg ref={ref} className="h-auto max-w-full" />
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
