import type { ReactNode } from "react";

const iconPaths = {
  check: <path d="m5 12.5 4.2 4.2L19 7" />,
  arrowRight: <path d="M5 12h14m-5.5-5.5L19 12l-5.5 5.5" />,
  chevronLeft: <path d="M14.5 6 8.5 12l6 6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  phone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </>
  ),
  monitor: (
    <>
      <rect x="2.5" y="4" width="19" height="12.5" rx="2" />
      <path d="M8.5 20.5h7M12 16.5v4" />
      <circle cx="12" cy="10.2" r="2.2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16.5 14.6c2.4.2 4 1.8 4.5 4.4" />
    </>
  ),
  gift: (
    <>
      <rect x="3.5" y="8.5" width="17" height="4" rx="1" />
      <path d="M5 12.5v8h14v-8M12 8.5v12" />
      <path d="M12 8.5S10.8 3.8 8 4.5c-2.2.6-1.4 4 4 4Zm0 0s1.2-4.7 4-4c2.2.6 1.4 4-4 4Z" />
    </>
  ),
  bolt: <path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8Z" />,
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12.5 9 5 9-5M3 16.5l9 5 9-5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  trophy: (
    <>
      <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0V4Z" />
      <path d="M7.5 6H4.5a3 3 0 0 0 3 4M16.5 6h3a3 3 0 0 1-3 4M12 13.5v3.5M8.5 20.5h7M9.5 17h5" />
    </>
  ),
  film: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m10 9.2 5 2.8-5 2.8V9.2Z" />
    </>
  ),
  chart: (
    <>
      <path d="M3.5 20.5h17" />
      <path d="m4.5 15.5 4.5-5 3.5 3 6.5-7.5" />
      <path d="M15 6h4v4" />
    </>
  ),
  sealCheck: (
    <>
      <path d="M12 2.8 14.3 4.6l2.9-.2.9 2.8 2.4 1.7-.9 2.8.9 2.8-2.4 1.7-.9 2.8-2.9-.2L12 21.2l-2.3-1.8-2.9.2-.9-2.8-2.4-1.7.9-2.8-.9-2.8 2.4-1.7.9-2.8 2.9.2L12 2.8Z" />
      <path d="m8.8 12.2 2.2 2.2 4.3-4.6" />
    </>
  ),
  bank: (
    <>
      <path d="M3 9.5 12 4l9 5.5H3Z" />
      <path d="M5.5 10v7.5M10 10v7.5M14 10v7.5M18.5 10v7.5M3.5 20.5h17" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="9.5" cy="7.5" rx="6" ry="3" />
      <path d="M3.5 7.5v4c0 1.7 2.7 3 6 3s6-1.3 6-3v-4" />
      <path d="M8.5 16.4c.9.4 2 .6 3.2.6 3.3 0 6-1.3 6-3v-.5M14 10.6c3.1.2 6.5 1.3 6.5 3v3.9c0 1.7-2.7 3-6 3-1.6 0-3-.3-4.1-.8" />
    </>
  ),
  star: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8L12 3.5Z" />,
  megaphone: (
    <>
      <path d="M4 10v4a1 1 0 0 0 1 1h2.5L14 19V5L7.5 9H5a1 1 0 0 0-1 1Z" />
      <path d="M17.5 9a4 4 0 0 1 0 6M8 15l1.2 5h2.3" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3.5" />
    </>
  ),
  gamepad: (
    <>
      <path d="M7 7.5h10a4.5 4.5 0 0 1 4.4 5.4l-.7 3.5a2.6 2.6 0 0 1-4.5 1.2L14.5 15.5h-5l-1.7 2.1a2.6 2.6 0 0 1-4.5-1.2l-.7-3.5A4.5 4.5 0 0 1 7 7.5Z" />
      <path d="M8 10.5v3M6.5 12h3M15.5 11h.01M17.5 13h.01" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5c2.5-1.3 5.2-1.3 8 0v14c-2.8-1.3-5.5-1.3-8 0v-14Z" />
      <path d="M12 5.5c2.8-1.3 5.5-1.3 8 0v14c-2.5-1.3-5.2-1.3-8 0" />
    </>
  ),
  mapPin: (
    <>
      <path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5.5l11-2V16" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1 12.5H6L5 8Z" />
      <path d="M9 10V6.5a3 3 0 0 1 6 0V10" />
    </>
  ),
  drum: (
    <>
      <path d="M7 3.5h10l-3.2 8.5 3.2 8.5H7l3.2-8.5L7 3.5Z" />
      <path d="M9.2 5.5 14 18.5M14.8 5.5 10 18.5" />
    </>
  ),
  crown: <path d="m3.5 8 4.2 3.5L12 5l4.3 6.5L20.5 8l-1.6 10.5H5.1L3.5 8Z" />,
  heart: <path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  chat: <path d="M4.5 18.5V6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8.5l-4 2Z" />,
  wifi: (
    <>
      <path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0" />
      <path d="M12 19.5h.01" />
    </>
  ),
  rotate: (
    <>
      <path d="M4.5 12a7.5 7.5 0 0 1 13-5.1L19.5 9" />
      <path d="M19.5 4.5V9H15M19.5 12a7.5 7.5 0 0 1-13 5.1L4.5 15" />
      <path d="M4.5 19.5V15H9" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type LandingIconName = keyof typeof iconPaths;

export function LandingIcon({ name, size = 20, className, strokeWidth = 1.8 }: { readonly name: LandingIconName; readonly size?: number; readonly className?: string; readonly strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      {iconPaths[name]}
    </svg>
  );
}
