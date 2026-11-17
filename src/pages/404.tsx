import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { cn } from "../utils/cn";

const NOT_FOUND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="236" height="274" viewBox="0 0 236 274" role="img" aria-label="404 СПИСАНИЕ · анимация построения">
  <title>404 СПИСАНИЕ · построение</title>
  <!-- Вставьте SVG в HTML или сохраните как .svg; анимация запускается при загрузке. -->
  <style>
    @keyframes reveal { from { opacity: 0 } to { opacity: 1 } }
    @keyframes trace { from { stroke-dashoffset: 100 } to { stroke-dashoffset: 0 } }
    @keyframes hideTrace { to { opacity: 0 } }
    @keyframes rise { from { opacity: 0; transform: translateY(var(--rise)) } to { opacity: 1; transform: translateY(0) } }
    @keyframes widen { from { opacity: 0; transform: scaleX(0) } to { opacity: 1; transform: scaleX(1) } }
    @keyframes extend { from { opacity: 0; transform: scaleY(0) } to { opacity: 1; transform: scaleY(1) } }
    @keyframes pop { from { opacity: 0; transform: scale(0.3) } to { opacity: 1; transform: scale(1) } }
    @keyframes guides { 0% { opacity: 0 } 10%, 88% { opacity: .65 } 99%, 100% { opacity: 0 } }
    @media (prefers-reduced-motion: reduce) {
      g[style], path[style] { animation: none !important; opacity: 1 !important; transform: none !important }
      path[stroke-dasharray], .construction-guides { display: none !important }
    }
  </style>
  <rect width="236" height="274" fill="#20282B"/>
  <g class="construction-guides" style="animation:guides 3600ms linear both" fill="none">
    <rect x="0.5" y="0.5" width="235" height="273" stroke="#5ec4eb" stroke-opacity=".35"/>
    <line x1="118.016" y1="14" x2="118.016" y2="256" stroke="#f5c400" stroke-dasharray="7 3 1.5 3"/>
    <line x1="67.74" y1="196" x2="67.74" y2="240" stroke="#5ec4eb" stroke-opacity=".4" stroke-dasharray="3 3"/>
    <line x1="168.26" y1="196" x2="168.26" y2="240" stroke="#5ec4eb" stroke-opacity=".4" stroke-dasharray="3 3"/>
    <line x1="57.536" y1="40" x2="57.536" y2="204" stroke="#5ec4eb" stroke-opacity=".4"/>
    <line x1="178.512" y1="40" x2="178.512" y2="204" stroke="#5ec4eb" stroke-opacity=".4"/>
    <line x1="69.632" y1="100" x2="69.632" y2="181" stroke="#5ec4eb" stroke-opacity=".4" stroke-dasharray="3 3"/>
    <line x1="87.77600000000001" y1="100" x2="87.77600000000001" y2="181" stroke="#5ec4eb" stroke-opacity=".4" stroke-dasharray="3 3"/>
    <line x1="95.84" y1="100" x2="95.84" y2="181" stroke="#5ec4eb" stroke-opacity=".4" stroke-dasharray="3 3"/>
    <line x1="113.98400000000001" y1="100" x2="113.98400000000001" y2="181" stroke="#5ec4eb" stroke-opacity=".4" stroke-dasharray="3 3"/>
    <line x1="122.048" y1="100" x2="122.048" y2="181" stroke="#5ec4eb" stroke-opacity=".4" stroke-dasharray="3 3"/>
    <line x1="140.192" y1="100" x2="140.192" y2="181" stroke="#5ec4eb" stroke-opacity=".4" stroke-dasharray="3 3"/>
    <line x1="148.256" y1="100" x2="148.256" y2="181" stroke="#5ec4eb" stroke-opacity=".4" stroke-dasharray="3 3"/>
    <line x1="166.4" y1="100" x2="166.4" y2="181" stroke="#5ec4eb" stroke-opacity=".4" stroke-dasharray="3 3"/>
    <line x1="64" y1="103.232" x2="172" y2="103.232" stroke="#5ec4eb" stroke-opacity=".4" stroke-dasharray="3 3"/>
    <line x1="64" y1="124.736" x2="172" y2="124.736" stroke="#5ec4eb" stroke-opacity=".4" stroke-dasharray="3 3"/>
    <line x1="64" y1="132.8" x2="172" y2="132.8" stroke="#5ec4eb" stroke-opacity=".4" stroke-dasharray="3 3"/>
    <line x1="64" y1="150.94400000000002" x2="172" y2="150.94400000000002" stroke="#5ec4eb" stroke-opacity=".4" stroke-dasharray="3 3"/>
    <line x1="64" y1="159.008" x2="172" y2="159.008" stroke="#5ec4eb" stroke-opacity=".4" stroke-dasharray="3 3"/>
    <line x1="64" y1="177.15200000000002" x2="172" y2="177.15200000000002" stroke="#5ec4eb" stroke-opacity=".4" stroke-dasharray="3 3"/>
    <line x1="60" y1="134.816" x2="176" y2="134.816" stroke="#5ec4eb" stroke-opacity=".4" stroke-dasharray="3 3"/>
    <line x1="60" y1="139.52" x2="176" y2="139.52" stroke="#5ec4eb" stroke-opacity=".4" stroke-dasharray="3 3"/>
    <line x1="57.536" y1="102.224" x2="118.016" y2="48.834" stroke="#f5c400" stroke-opacity=".4" stroke-dasharray="3 3"/>
    <line x1="178.512" y1="102.224" x2="118.016" y2="48.834" stroke="#f5c400" stroke-opacity=".4" stroke-dasharray="3 3"/>
    <line x1="56" y1="204" x2="180" y2="204" stroke="#5ec4eb" stroke-opacity=".4"/>
    <line x1="56" y1="232" x2="180" y2="232" stroke="#5ec4eb" stroke-opacity=".4"/>
  </g>
  <g transform="translate(32 32)">
    <g transform="translate(0 0) scale(0.336)">
      <path d="M243.1 54.9A20 20 0 0 1 268.9 54.9L426.07 187.61A28 28 0 0 1 436 209L436 440A28 28 0 0 1 408 468L104 468A28 28 0 0 1 76 440L76 209A28 28 0 0 1 85.93 187.61Z" fill="#f5c400" style="opacity:0;animation:reveal 292ms cubic-bezier(.33,1,.68,1) 644ms both"/>
      <path d="M243.1 54.9A20 20 0 0 1 268.9 54.9L426.07 187.61A28 28 0 0 1 436 209L436 440A28 28 0 0 1 408 468L104 468A28 28 0 0 1 76 440L76 209A28 28 0 0 1 85.93 187.61Z" fill="none" stroke="#f5c400" stroke-width="4" pathLength="100" stroke-dasharray="100" style="stroke-dashoffset:100;animation:trace 648ms cubic-bezier(.33,1,.68,1) 288ms both,hideTrace 60ms linear 936ms forwards"/>
      <g style="--rise:32px;transform-box:fill-box;transform-origin:center;animation:rise 432ms cubic-bezier(.33,1,.68,1) 792ms both"><path d="M116 172V100A8 8 0 0 1 124 92H152A8 8 0 0 1 160 100V172Z" fill="#f5c400"/></g>
      <g style="--rise:30px;transform-box:fill-box;transform-origin:center top;animation:extend 504ms cubic-bezier(.33,1,.68,1) 1080ms both"><rect x="112" y="212" width="288" height="220" rx="18" fill="#ecf6fa"/></g>
      <g style="--rise:30px;transform-box:fill-box;transform-origin:left center;animation:widen 180ms cubic-bezier(.33,1,.68,1) 1440ms both"><rect x="134" y="236" width="10" height="172" rx="3" fill="#2b2b2b"/></g>
      <g style="--rise:30px;transform-box:fill-box;transform-origin:left center;animation:widen 180ms cubic-bezier(.33,1,.68,1) 1494ms both"><rect x="152" y="236" width="10" height="172" rx="3" fill="#2b2b2b"/></g>
      <g style="--rise:30px;transform-box:fill-box;transform-origin:left center;animation:widen 180ms cubic-bezier(.33,1,.68,1) 1548ms both"><rect x="174" y="236" width="20" height="146" rx="3" fill="#2b2b2b"/></g>
      <g style="--rise:30px;transform-box:fill-box;transform-origin:left center;animation:widen 180ms cubic-bezier(.33,1,.68,1) 1602ms both"><rect x="204" y="236" width="10" height="146" rx="3" fill="#2b2b2b"/></g>
      <g style="--rise:30px;transform-box:fill-box;transform-origin:left center;animation:widen 180ms cubic-bezier(.33,1,.68,1) 1656ms both"><rect x="222" y="236" width="16" height="146" rx="3" fill="#2b2b2b"/></g>
      <g style="--rise:30px;transform-box:fill-box;transform-origin:left center;animation:widen 180ms cubic-bezier(.33,1,.68,1) 1710ms both"><rect x="248" y="236" width="8" height="172" rx="3" fill="#2b2b2b"/></g>
      <g style="--rise:30px;transform-box:fill-box;transform-origin:left center;animation:widen 180ms cubic-bezier(.33,1,.68,1) 1764ms both"><rect x="264" y="236" width="8" height="172" rx="3" fill="#2b2b2b"/></g>
      <g style="--rise:30px;transform-box:fill-box;transform-origin:left center;animation:widen 180ms cubic-bezier(.33,1,.68,1) 1818ms both"><rect x="282" y="236" width="22" height="146" rx="3" fill="#2b2b2b"/></g>
      <g style="--rise:30px;transform-box:fill-box;transform-origin:left center;animation:widen 180ms cubic-bezier(.33,1,.68,1) 1872ms both"><rect x="314" y="236" width="10" height="146" rx="3" fill="#2b2b2b"/></g>
      <g style="--rise:30px;transform-box:fill-box;transform-origin:left center;animation:widen 180ms cubic-bezier(.33,1,.68,1) 1926ms both"><rect x="332" y="236" width="16" height="146" rx="3" fill="#2b2b2b"/></g>
      <g style="--rise:30px;transform-box:fill-box;transform-origin:left center;animation:widen 180ms cubic-bezier(.33,1,.68,1) 1980ms both"><rect x="360" y="236" width="8" height="172" rx="3" fill="#2b2b2b"/></g>
      <g style="--rise:30px;transform-box:fill-box;transform-origin:left center;animation:widen 180ms cubic-bezier(.33,1,.68,1) 2034ms both"><rect x="376" y="236" width="10" height="172" rx="3" fill="#2b2b2b"/></g>
      <g style="--rise:30px;transform-box:fill-box;transform-origin:center;animation:pop 216ms cubic-bezier(.2,1.45,.3,1) 2016ms both"><rect x="174" y="396" width="28" height="12" rx="5" fill="#2b2b2b"/></g>
      <g style="--rise:30px;transform-box:fill-box;transform-origin:center;animation:pop 216ms cubic-bezier(.2,1.45,.3,1) 2106ms both"><rect x="210" y="396" width="28" height="12" rx="5" fill="#2b2b2b"/></g>
      <g style="--rise:30px;transform-box:fill-box;transform-origin:center;animation:pop 216ms cubic-bezier(.2,1.45,.3,1) 2196ms both"><rect x="282" y="396" width="28" height="12" rx="5" fill="#2b2b2b"/></g>
      <g style="--rise:30px;transform-box:fill-box;transform-origin:center;animation:pop 216ms cubic-bezier(.2,1.45,.3,1) 2286ms both"><rect x="318" y="396" width="30" height="12" rx="5" fill="#2b2b2b"/></g>
      <g style="--rise:30px;transform-box:fill-box;transform-origin:center;animation:widen 576ms cubic-bezier(.33,1,.68,1) 2448ms both"><rect x="98" y="306" width="316" height="14" rx="7" fill="#e0a800"/></g>
    </g>
    <g transform="translate(0 172)">
      <g style="--rise:10px;animation:rise 324ms cubic-bezier(.33,1,.68,1) 2808ms both"><path d="M332 0H650V385H735V588H650V700H415V588H0V406ZM415 214L269 385H415Z" fill="#f5c400" transform="translate(35.74 0) scale(0.04)"/></g>
      <g style="--rise:10px;animation:rise 324ms cubic-bezier(.33,1,.68,1) 2952ms both"><path d="M376.25 -26.25C583.68 -26.25 752.5 142.56 752.5 350C752.5 557.44 583.68 726.25 376.25 726.25C168.81 726.25 0 557.44 0 350C0 142.56 168.81 -26.25 376.25 -26.25ZM376.25 493.59C455.54 493.59 519.84 429.07 519.84 350C519.84 270.93 455.54 206.41 376.25 206.41C296.95 206.41 232.65 270.93 232.65 350C232.65 429.07 296.95 493.59 376.25 493.59Z" fill="#f5c400" transform="translate(70.94 0) scale(0.04)"/></g>
      <g style="--rise:10px;animation:rise 324ms cubic-bezier(.33,1,.68,1) 3096ms both"><path d="M332 0H650V385H735V588H650V700H415V588H0V406ZM415 214L269 385H415Z" fill="#f5c400" transform="translate(106.86 0) scale(0.04)"/></g>
    </g>
  </g>
</svg>`;

const ART_MAX_WIDTH = 280;
const ART_VIEWBOX_WIDTH = 236;
const ART_BOTTOM_PAD = 40.95;
const LOGO_GAP_PX = 24;
const PLAY_MS = 3600;
const HOLD_MS = 2000;
const BLANK_MS = 1000;

type Phase = "play" | "hold" | "blank";

interface NotFoundPageProps {
  homeHref: string;
  onGoHome: () => void;
}

/** Страница /404 — отображается при переходе на несуществующий адрес */
export default function NotFoundPage({ homeHref, onGoHome }: NotFoundPageProps) {
  const artRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("play");
  const [cycle, setCycle] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    if (media.matches) {
      return () => media.removeEventListener("change", onChange);
    }

    let timers: number[] = [];
    const schedule = () => {
      timers.push(window.setTimeout(() => setPhase("hold"), PLAY_MS));
      timers.push(window.setTimeout(() => setPhase("blank"), PLAY_MS + HOLD_MS));
      timers.push(
        window.setTimeout(() => {
          setPhase("play");
          setCycle((n) => n + 1);
          schedule();
        }, PLAY_MS + HOLD_MS + BLANK_MS),
      );
    };
    schedule();

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      timers = [];
      media.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    const container = artRef.current;
    if (!container) return;
    container.innerHTML = NOT_FOUND_SVG;
  }, [cycle, reducedMotion]);

  const handleHomeClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    onGoHome();
  };

  return (
    <section
      data-nf-phase={phase}
      className="nf-page relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#20282B] px-6 py-16 text-center text-white"
      aria-label="Страница не найдена (404)"
    >
      <div className="flex w-full max-w-[560px] flex-col items-center">
        <div
          className={cn(
            "w-full transition-opacity duration-500",
            phase === "blank" ? "opacity-0" : "opacity-100",
          )}
          style={{ maxWidth: ART_MAX_WIDTH }}
          aria-hidden={phase === "blank"}
        >
          <div ref={artRef} className="nf-art" />
        </div>

        <div
          data-testid="nf-text"
          className="relative z-10 flex max-w-xl flex-col items-center text-center"
          style={{
            marginTop: `calc(${LOGO_GAP_PX}px - min(${ART_MAX_WIDTH}px, 100%) * ${ART_BOTTOM_PAD} / ${ART_VIEWBOX_WIDTH})`,
          }}
        >
          <h1 className="text-[46px] font-black leading-[0.98] tracking-[-0.02em] sm:text-[64px] lg:text-[76px]">
            Страница
            <br />
            <span className="text-[#f5c400]">не найдена</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/65 lg:text-[17px]">
            Такого адреса на сайте нет: возможно, в ссылке опечатка или страница была переименована.
          </p>
          <div className="mt-8 flex justify-center">
            <a
              href={homeHref}
              onClick={handleHomeClick}
              className="inline-flex h-[52px] items-center gap-2 rounded-2xl bg-[#f5c400] px-7 text-[15px] font-extrabold text-[#20282B] transition-all hover:gap-3 hover:bg-[#ffe066]"
            >
              На главную
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
