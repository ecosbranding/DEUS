import type { CSSProperties, ReactNode } from 'react';

const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const ICONS: Record<string, ReactNode> = {
  // powers
  life: (
    <>
      <circle cx="12" cy="6.2" r="3.4" />
      <path d="M5.5 21.5c0-5.4 2.7-9.6 6.5-9.6s6.5 4.2 6.5 9.6z" />
    </>
  ),
  bless: <path d="M11 2l2.3 6.7L20 11l-6.7 2.3L11 20l-2.3-6.7L2 11l6.700-2.3zM19 15.5l.9 2.1 2.1.9-2.1.9-.9 2.100-.9-2.1-2.1-.9 2.1-.9z" />,
  bolt: <path d="M13.800 1.5L4 13.6h5.800l-1.600 8.900L19.800 9.800h-6.300z" />,
  mount: <path d="M1 20.500L8.800 6.500l4.200 7 2.800-4 7.200 11z" />,
  river: <path {...line} d="M2 6.500c2.500-2.500 4.500-2.500 7 0s4.500 2.500 7 0 4-2 6-.5M2 12c2.500-2.500 4.500-2.500 7 0s4.500 2.500 7 0 4-2 6-.5M2 17.500c2.500-2.500 4.500-2.500 7 0s4.500 2.500 7 0 4-2 6-.5" />,
  plant: <path d="M12 1.500l5 6.500h-2.500l4 5.500H15l4.500 5.500h-6V22.500h-3V19h-6L9 13.500H5.500l4-5.500H7z" />,
  animal: (
    <>
      <ellipse cx="5.500" cy="10" rx="2" ry="2.700" />
      <ellipse cx="9.700" cy="5.500" rx="2" ry="2.700" />
      <ellipse cx="14.300" cy="5.500" rx="2" ry="2.700" />
      <ellipse cx="18.500" cy="10" rx="2" ry="2.700" />
      <path d="M12 10.800c-3 0-5.700 3.500-5.700 6.300 0 2 1.500 3.100 3 3.100 1.200 0 1.700-.6 2.700-.6s1.500.6 2.700.6c1.500 0 3-1.100 3-3.100 0-2.800-2.700-6.300-5.700-6.300z" />
    </>
  ),
  plague: (
    <>
      <circle cx="12" cy="12" r="5.600" />
      <path {...line} d="M12 2v4M12 18v4M2 12h4M18 12h4M4.900 4.900l2.800 2.800M16.300 16.300l2.800 2.800M4.900 19.100l2.800-2.800M16.300 7.700l2.800-2.800" />
    </>
  ),
  meteor: (
    <>
      <circle cx="8.500" cy="15.500" r="5.800" />
      <path {...line} d="M13.500 8.500l8-6.500M17 13l5.500-3M9.500 6.500l4.500-4.500" />
    </>
  ),
  heal: <path d="M12 1.800C8.500 7 5.500 10.600 5.500 14.600a6.500 6.500 0 0013 0c0-4-3-7.600-6.500-12.800z" />,
  // stats / ui
  house: <path d="M12 2.500L1.500 11.500h3V21h5.500v-6h4v6h5.500v-9.500h3z" />,
  star: <path d="M12 2l3 6.600 7.100.8-5.300 4.900 1.500 7.100L12 17.800l-6.300 3.600 1.500-7.100L1.900 9.400 9 8.600z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" {...line} />
      <path {...line} d="M12 7v5.500l3.500 2" />
    </>
  ),
  planet: (
    <>
      <circle cx="12" cy="12" r="6" />
      <ellipse cx="12" cy="12" rx="11" ry="3.400" fill="none" stroke="currentColor" strokeWidth="1.700" transform="rotate(-20 12 12)" />
    </>
  ),
  map: (
    <>
      <circle cx="12" cy="12" r="2.2" />
      <ellipse cx="12" cy="12" rx="10" ry="4.4" fill="none" stroke="currentColor" strokeWidth="1.7" transform="rotate(-24 12 12)" />
      <circle cx="19.1" cy="8.8" r="1.6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="7.5" r="4" />
      <path d="M4 21v-1.4a8 8 0 0116 0V21z" />
    </>
  ),
  logout: <path d="M10 4H5.5A2.5 2.5 0 003 6.5v11A2.5 2.5 0 005.5 20H10v-2H5.5a.5.5 0 01-.5-.5v-11a.5.5 0 01.5-.5H10zm5.6 2.4L14.2 7.8l3.2 3.2H9v2h8.4l-3.2 3.2 1.4 1.4 5.6-5.6z" />,
  close: <path d="M5.4 4L12 10.6 18.6 4 20 5.4 13.4 12 20 18.6 18.6 20 12 13.4 5.4 20 4 18.6 10.6 12 4 5.4z" />,
  crown: <path d="M3 19L1.500 7l6 5L12 4l4.500 8 6-5L21 19z" />,
  sound: (
    <>
      <path d="M3 9v6h4l5 4.500v-15L7 9z" />
      <path {...line} d="M15.500 8.500a5 5 0 010 7M18.500 5.500a9 9 0 010 13" />
    </>
  ),
  mute: (
    <>
      <path d="M3 9v6h4l5 4.500v-15L7 9z" />
      <path {...line} d="M16 9l6 6M22 9l-6 6" />
    </>
  ),
  pause: <path d="M6 4h4.500v16H6zM13.500 4H18v16h-4.500z" />,
  play: <path d="M7 3.500l13 8.500-13 8.500z" />,
  restart: <path {...line} d="M19.500 12A7.500 7.500 0 1112 4.500c2.200 0 4.100.9 5.500 2.300M18 2.500v4.800h-4.800" />,
  tap: (
    <>
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.800" strokeDasharray="3 3.500" />
    </>
  ),
  orbit: <path {...line} d="M3.500 12a8.500 8.500 0 0114.700-5.800M20.500 12a8.500 8.500 0 01-14.700 5.800M18.500 2.500v4h-4M5.500 21.500v-4h4" />,
  zoom: (
    <>
      <circle cx="10.500" cy="10.500" r="6.500" {...line} />
      <path {...line} d="M15.500 15.500L21 21M7.500 10.500h6M10.500 7.500v6" />
    </>
  ),
  warn: <path d="M12 2L1 21h22zM11 9h2v6h-2zM11 16.500h2v2.200h-2z" fillRule="evenodd" />,
};

export default function Icon({ name, className = 'h-4 w-4', style }: { name: string; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={`inline-block shrink-0 ${className}`} style={style} aria-hidden="true">
      {ICONS[name] ?? ICONS.star}
    </svg>
  );
}
