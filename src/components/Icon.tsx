export function Icon({
  name,
  size = 20,
}: {
  name:
    | 'grid'
    | 'content'
    | 'arrow'
    | 'calendar'
    | 'spark'
    | 'eye'
    | 'people'
    | 'plus'
    | 'globe'
    | 'chat'
    | 'trend'
  size?: number
}) {
  const paths = {
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    content: 'M5 3h14v18H5z M9 7h6 M9 11h6 M9 15h3',
    arrow: 'M5 12h14 M13 6l6 6-6 6',
    calendar: 'M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16',
    spark: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    people:
      'M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M3 21v-3a7 7 0 0 1 14 0v3 M17 4a4 4 0 0 1 0 8 M20 21v-3a7 7 0 0 0-2-5',
    plus: 'M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M3 21v-3a7 7 0 0 1 12-5 M19 13v8 M15 17h8',
    globe:
      'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M3 12h18 M12 3a20 20 0 0 1 0 18 20 20 0 0 1 0-18',
    chat: 'M21 11a9 9 0 0 1-9 9H4l-2 2 1-7a9 9 0 1 1 18-4 M8 11h.01 M12 11h.01 M16 11h.01',
    trend: 'M3 17l6-6 4 4 8-10 M15 5h6v6',
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}
