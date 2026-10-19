// Line icons from the Plum design. Decorative: always aria-hidden, labelled by their button.
type IconProps = { size?: number };

function Svg({
  size = 18,
  children,
  strokeWidth = 1.8,
}: IconProps & { children: React.ReactNode; strokeWidth?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const SearchIcon = ({ size }: IconProps) => (
  <Svg size={size ?? 16} strokeWidth={2}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Svg>
);

export const EditIcon = ({ size }: IconProps) => (
  <Svg size={size ?? 17}>
    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </Svg>
);

export const TrashIcon = ({ size }: IconProps) => (
  <Svg size={size ?? 17}>
    <path d="M4 7h16" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 13h10l1-13" />
  </Svg>
);

export const SparkleIcon = ({ size }: IconProps) => (
  <Svg size={size ?? 16}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
  </Svg>
);

export const SendIcon = ({ size }: IconProps) => (
  <Svg size={size ?? 16} strokeWidth={2}>
    <path d="M12 19V5" />
    <path d="M6 11l6-6 6 6" />
  </Svg>
);

export const PlusIcon = ({ size }: IconProps) => (
  <Svg size={size ?? 16} strokeWidth={2.2}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Svg>
);

export const ChevronDownIcon = ({ size }: IconProps) => (
  <Svg size={size ?? 12} strokeWidth={2.4}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
