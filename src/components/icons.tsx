import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const BarcodeLogo = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <rect x="3" y="5" width="1.5" height="14" />
    <rect x="6" y="5" width="1" height="14" />
    <rect x="8.5" y="5" width="2" height="14" />
    <rect x="12" y="5" width="1" height="14" />
    <rect x="14.5" y="5" width="1.5" height="14" />
    <rect x="17.5" y="5" width="1" height="14" />
    <rect x="19.5" y="5" width="1.5" height="14" />
  </svg>
);

export const RefreshIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </svg>
);

export const GearIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const XIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const TrashIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const ExternalLinkIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);

export const AlertIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

export const SpinnerIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M21 12a9 9 0 1 1-6.22-8.56" />
  </svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const PrinterIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M6 9V2h12v7" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" rx="1" />
  </svg>
);

export const CameraIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
);

export const LinkIcon = (p: IconProps) => (
  <svg {...stroke} {...p}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
