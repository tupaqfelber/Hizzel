const SIZE_CLASSES = {
  sm: "px-[13px] py-[5px] text-[11px]",
  md: "px-3.5 py-[7px] text-xs",
} as const;

export function Pill({
  active,
  size = "md",
  children,
  ...props
}: {
  active: boolean;
  size?: keyof typeof SIZE_CLASSES;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`shrink-0 rounded-full font-medium whitespace-nowrap ${SIZE_CLASSES[size]} ${
        active ? "bg-linen-ink text-linen" : "bg-linen-field text-linen-ink-secondary"
      }`}
      {...props}
    >
      {children}
    </button>
  );
}
