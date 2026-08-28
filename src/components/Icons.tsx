/* 시안에서 쓰인 lucide 아이콘을 필요한 것만 인라인 SVG로 옮겼다. */

interface IconProps {
  size?: number
  className?: string
}

function Svg({
  size = 16,
  className,
  fill = 'none',
  children,
}: IconProps & { fill?: string; children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const PauseIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </Svg>
)

export const CloseIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
)

export const ShieldIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </Svg>
)

export const TrophyIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0z" />
  </Svg>
)

export const GamepadIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 11h4M8 9v4M15 12h.01M18 10h.01" />
    <path d="M17.3 5H6.7a4 4 0 0 0-3.9 3.1L1.5 14a3 3 0 0 0 5 2.8L8.2 15h7.6l1.7 1.8a3 3 0 0 0 5-2.8l-1.3-5.9A4 4 0 0 0 17.3 5Z" />
  </Svg>
)

export const BookIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 7v14" />
    <path d="M3 18a1 1 0 0 1-1-1V5a2 2 0 0 1 2-2h5a3 3 0 0 1 3 3v15a3 3 0 0 0-3-3Z" />
    <path d="M21 18a1 1 0 0 0 1-1V5a2 2 0 0 0-2-2h-5a3 3 0 0 0-3 3v15a3 3 0 0 1 3-3Z" />
  </Svg>
)

export const ClockIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </Svg>
)

export const ZapIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 14h7l-2 7 9-11h-7l2-7z" />
  </Svg>
)

export const ArrowRightIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </Svg>
)

export const CheckIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
)

export const InfoIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </Svg>
)

export const MenuIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Svg>
)

/** 초성게임 오답 기회 표시. 남은 기회는 채워서, 소진한 기회는 비워서 그린다. */
export const HeartIcon = ({ filled = true, ...props }: IconProps & { filled?: boolean }) => (
  <Svg {...props} fill={filled ? 'currentColor' : 'none'}>
    <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
  </Svg>
)

/** 초성게임 힌트 전구. 사용 가능하면 채운 노란 전구, 사용하면 빈 전구 (상세 3-3) */
export const BulbIcon = ({ filled = true, ...props }: IconProps & { filled?: boolean }) => (
  <Svg {...props} fill={filled ? 'currentColor' : 'none'}>
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6" />
    <path d="M10 22h4" />
  </Svg>
)
