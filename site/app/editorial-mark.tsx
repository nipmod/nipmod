import type { CSSProperties } from "react";

export function NipmodMark({ size = 46 }: { size?: number }) {
  return (
    <span className="nipmod-mark" aria-hidden="true" style={{ "--mark-size": `${size}px` } as CSSProperties}>
      <svg fill="currentColor" viewBox="12 8 42 44" width={size} height={size}>
        <path d="M16 50 Q 16 14 32 14 Q 48 14 48 38 L48 50 L42 50 L42 38 Q 42 22 32 22 Q 22 22 22 50 Z" />
        <circle cx="48" cy="14" r="3.5" />
      </svg>
    </span>
  );
}

export function IconCheck({ size = 14 }: { size?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 16 16" width={size}>
      <path d="M3.5 8.5L6.5 11.5L12.5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

export function IconSearch({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 16 16" width={size}>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 10.5L13 13" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
    </svg>
  );
}

export function IconShield({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 16 16" width={size}>
      <path d="M8 2L13 4V8.2C13 11 10.8 13.2 8 14C5.2 13.2 3 11 3 8.2V4L8 2Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.3" />
    </svg>
  );
}

export function IconBox({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 16 16" width={size}>
      <path d="M8 1.8L13.5 4.4V10.6L8 13.2L2.5 10.6V4.4L8 1.8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.3" />
      <path d="M8 7.5L13.5 4.7M8 7.5L2.5 4.7M8 7.5V13.2" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.3" />
    </svg>
  );
}
