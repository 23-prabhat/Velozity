import type { ReactNode, SVGProps } from 'react'

const paths: Record<string, ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
  folder: <path d="M3 6h6l2 2h10v11H3z"/>, check: <><rect x="3" y="3" width="18" height="18"/><path d="m8 12 3 3 6-7"/></>,
  building: <><path d="M4 21V4h11v17M15 9h5v12M8 8h3M8 12h3M8 16h3M18 13h.01M18 17h.01M2 21h20"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  pulse: <path d="M3 12h4l2-7 4 14 2-7h6"/>, bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
  plus: <path d="M12 5v14M5 12h14"/>, arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>, search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16"/>, close: <path d="m6 6 12 12M18 6 6 18"/>, alert: <><path d="M12 3 2 21h20z"/><path d="M12 9v4M12 17h.01"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M13 3h8v18h-8"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>, eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></>,
}

export function Icon({ name, size = 18, ...props }: SVGProps<SVGSVGElement> & { name: keyof typeof paths; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true" {...props}>{paths[name]}</svg>
}
