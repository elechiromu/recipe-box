const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const IconPlus = (p) => <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>;
export const IconBack = (p) => <svg {...base} {...p}><path d="M15 18l-6-6 6-6" /></svg>;
export const IconSearch = (p) => <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
export const IconClock = (p) => <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const IconUsers = (p) => <svg {...base} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.8c1.8.7 3 2.5 3.5 5.2" /></svg>;
export const IconStar = ({ filled, ...p }) => <svg {...base} {...p} fill={filled ? 'currentColor' : 'none'}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></svg>;
export const IconEdit = (p) => <svg {...base} {...p}><path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>;
export const IconTrash = (p) => <svg {...base} {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>;
export const IconPot = (p) => <svg {...base} {...p}><path d="M4 10h16v6a4 4 0 01-4 4H8a4 4 0 01-4-4zM2 10h2M20 10h2M9 6c0-1 1-1.5 1-2.5M14 6c0-1 1-1.5 1-2.5" /></svg>;
export const IconLink = (p) => <svg {...base} {...p}><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></svg>;
export const IconCamera = (p) => <svg {...base} {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>;
export const IconClose = (p) => <svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconList = (p) => <svg {...base} {...p}><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></svg>;
export const IconCalendar = (p) => <svg {...base} {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>;
export const IconCheck = (p) => <svg {...base} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const IconTimer = (p) => <svg {...base} {...p}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M10 2h4" /></svg>;
