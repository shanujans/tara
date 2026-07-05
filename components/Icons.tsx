// Inline SVG icons — no external font dependency
import React from 'react';

// 1. Added 'glass' to your interface
interface P { 
  size?: number; 
  className?: string; 
  style?: React.CSSProperties; 
  glass?: boolean; // <-- New prop!
}

// 2. The minimal border + blur styles for visibility
const glassStyles: React.CSSProperties = {
  backgroundColor: 'rgba(30, 30, 45, 0.65)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)', // For Safari
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '8px', // Change to '50%' if you prefer circular backgrounds
  padding: '6px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
};

const svg = (size: number, children: React.ReactNode, extra?: Record<string, unknown>) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    aria-hidden {...extra}>
    {children}
  </svg>
);

// 3. A smart wrapper that applies the glass effect if requested
const Wrapper = ({ glass, style, children, ...p }: P & { children: React.ReactNode }) => (
  <span style={{ ...(glass ? glassStyles : {}), ...style }} {...p}>
    {children}
  </span>
);

// 4. Your icons, now powered by the new Wrapper
export const HomeIcon    = ({size=20,...p}:P) => <Wrapper {...p}>{svg(size,<><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>)}</Wrapper>;
export const HistoryIcon = ({size=20,...p}:P) => <Wrapper {...p}>{svg(size,<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>)}</Wrapper>;
export const RewardsIcon = ({size=20,...p}:P) => <Wrapper {...p}>{svg(size,<><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></>)}</Wrapper>;
export const BrowseIcon  = ({size=20,...p}:P) => <Wrapper {...p}>{svg(size,<><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></>)}</Wrapper>;
export const CartIcon    = ({size=20,...p}:P) => <Wrapper {...p}>{svg(size,<><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></>)}</Wrapper>;
export const SettingsIcon= ({size=20,...p}:P) => <Wrapper {...p}>{svg(size,<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>)}</Wrapper>;
export const HelpIcon    = ({size=20,...p}:P) => <Wrapper {...p}>{svg(size,<><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></>)}</Wrapper>;
export const BellIcon    = ({size=20,...p}:P) => <Wrapper {...p}>{svg(size,<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>)}</Wrapper>;
export const MicIcon     = ({size=20,...p}:P) => <Wrapper {...p}>{svg(size,<><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>)}</Wrapper>;
export const SendIcon    = ({size=20,...p}:P) => <Wrapper {...p}>{svg(size,<path d="m22 2-7 20-4-9-9-4 20-7z" fill="currentColor" stroke="none"/>)}</Wrapper>;
export const AttachIcon  = ({size=18,...p}:P) => <Wrapper {...p}>{svg(size,<><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></>)}</Wrapper>;
export const MenuIcon    = ({size=22,...p}:P) => <Wrapper {...p}>{svg(size,<><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>)}</Wrapper>;
export const XIcon    = ({size=22,...p}:P) => <Wrapper {...p}>{svg(size,<><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/></>)}</Wrapper>;
export const CheckIcon   = ({size=16,...p}:P) => <Wrapper {...p}>{svg(size,<polyline points="20 6 9 17 4 12" strokeWidth={2.5}/>)}</Wrapper>;
export const AddCartIcon = ({size=16,...p}:P) => <Wrapper {...p}>{svg(size,<><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/><line x1="17" y1="0" x2="17" y2="6"/><line x1="14" y1="3" x2="20" y2="3"/></>)}</Wrapper>;
export const GlobeIcon   = ({size=16,...p}:P) => <Wrapper {...p}>{svg(size,<><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>)}</Wrapper>;
export const ChatIcon    = ({size=22,...p}:P) => <Wrapper {...p}>{svg(size,<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>)}</Wrapper>;
export const BagIcon     = ({size=22,...p}:P) => <Wrapper {...p}>{svg(size,<><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></>)}</Wrapper>;
export const SparkleIcon = ({size=22,...p}:P) => <Wrapper {...p}>{svg(size,<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>)}</Wrapper>;
export const StoreIcon   = ({size=20,...p}:P) => <Wrapper {...p}>{svg(size,<><path d="m19 10-4-6H9L5 10"/><rect width="20" height="12" x="2" y="10" rx="2"/><path d="M12 14v4"/><path d="M7 14v4"/><path d="M17 14v4"/></>)}</Wrapper>;
export const HeadsetIcon = ({size=20,...p}:P) => <Wrapper {...p}>{svg(size,<><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></>)}</Wrapper>;
export const ChevronRightIcon = ({size=16,...p}:P) => <Wrapper {...p}>{svg(size,<polyline points="9 18 15 12 9 6"/>)}</Wrapper>;
export const PackageIcon = ({size=20,...p}:P) => <Wrapper {...p}>{svg(size,<><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>)}</Wrapper>;
export const TrashIcon   = ({size=16,...p}:P) => <Wrapper {...p}>{svg(size,<><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>)}</Wrapper>;
export const UserIcon    = ({size=20,...p}:P) => <Wrapper {...p}>{svg(size,<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>)}</Wrapper>;
export const ThumbsUpIcon  = ({size=14,...p}:P) => <Wrapper {...p}>{svg(size,<><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></>)}</Wrapper>;
export const ThumbsDownIcon= ({size=14,...p}:P) => <Wrapper {...p}>{svg(size,<><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></>)}</Wrapper>;
export const SunIcon     = ({size=18,...p}:P) => <Wrapper {...p}>{svg(size,<><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>)}</Wrapper>;

// Newly added icons below:
export const RepeatIcon = ({size=20,...p}:P) => <Wrapper {...p}>{svg(size,<><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></>)}</Wrapper>;
export const VoiceSparkleIcon = ({size=20,...p}:P) => <Wrapper {...p}>{svg(size,
  <>
    <path d="M8 11v4" />
    <path d="M12 7v10" />
    <path d="M16 13v3" />
    <path d="M17 3l-1 2-2 1 2 1 1 2 1-2 2-1-2-1Z" fill="currentColor" />
  </>
)}</Wrapper>;