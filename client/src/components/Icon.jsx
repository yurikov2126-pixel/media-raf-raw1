const PATHS = {
  home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/><path d="M9 20v-5h6v5"/></>,
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  feed: <><path d="M4 5.5h16"/><path d="M4 10.5h10"/><path d="M4 15.5h16"/><path d="M4 20.5h10"/></>,
  search: <><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></>,
  plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  message: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-5.2 4v-4.2a2.5 2.5 0 0 1-1.8-2.3z"/><path d="M7.5 8h9M7.5 11.5h6"/></>,
  book: <><path d="M5 4.5h9.5A3.5 3.5 0 0 1 18 8v11.5H7.5A2.5 2.5 0 0 1 5 17z"/><path d="M7.5 19.5A2.5 2.5 0 0 0 10 17V4.5"/><path d="M12.5 9h3"/></>,
  bell: <><path d="M6 10a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20h4"/></>,
  user: <><circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5.8M17 14a4 4 0 0 1 3.5 4"/></>,
  more: <><circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none"/></>,
  trophy: <><path d="M8 4h8v4a4 4 0 0 1-8 0z"/><path d="M8 6H5v1.5A3.5 3.5 0 0 0 8.5 11"/><path d="M16 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5"/><path d="M12 12v4"/><path d="M9 20h6M10 16h4"/></>,
  settings: <><path d="m12 3 1.2 2.4 2.6.4.8 2.5 2.2 1.5-1.3 2.4 1.3 2.4-2.2 1.5-.8 2.5-2.6.4L12 21l-1.2-2.4-2.6-.4-.8-2.5-2.2-1.5 1.3-2.4-1.3-2.4 2.2-1.5.8-2.5 2.6-.4z"/><circle cx="12" cy="12" r="2.7"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
  moon: <><path d="M20 14.2A7.5 7.5 0 0 1 9.8 4 7.6 7.6 0 1 0 20 14.2z"/></>,
  command: <><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h6v6H9z"/><path d="M9 4v3M15 4v3M9 17v3M15 17v3M4 9h3M17 9h3M4 15h3M17 15h3"/></>,
  arrowRight: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  chevronRight: <path d="m9 18 6-6-6-6"/>,
  chevronDown: <path d="m6 9 6 6 6-6"/>,
  sparkles: <><path d="m12 3 1.3 5.7L19 10l-5.7 1.3L12 17l-1.3-5.7L5 10l5.7-1.3z"/><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6z"/></>,
  newspaper: <><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 9h16"/><path d="M8 13h2M12 13h2M16 13h0M8 16h2"/></>,
  clock: <><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></>,
  zap: <path d="m13 2-8 11h6l-1 9 8-12h-6z"/>,
  logOut: <><path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/><path d="M14 8l4 4-4 4M10 12h8"/></>,
  x: <><path d="m6 6 12 12M18 6 6 18"/></>,
  sliders: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></>,
  layers: <><path d="m12 3 9 5-9 5-9-5z"/><path d="m4 12 8 4.5 8-4.5M4 16.5l8 4.5 8-4.5"/></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></>,
};

export default function Icon({
  name = 'sparkles',
  size = 20,
  strokeWidth = 1.8,
  className = '',
  title,
}) {
  const content = PATHS[name] || PATHS.sparkles;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {content}
    </svg>
  );
}
