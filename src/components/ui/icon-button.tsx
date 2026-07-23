import type { Icon } from "@tabler/icons-react";

const SIZE_PX = { sm: 30, md: 36 } as const;

export function IconButton({
  icon: Icon,
  size = "sm",
  shape = "circle",
  label,
  className = "",
  ...props
}: {
  icon: Icon;
  size?: keyof typeof SIZE_PX;
  shape?: "circle" | "square";
  label: string;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const px = SIZE_PX[size];
  return (
    <button
      type="button"
      aria-label={label}
      style={{ width: px, height: px }}
      className={`flex shrink-0 items-center justify-center bg-linen-field text-linen-ink-secondary ${
        shape === "circle" ? "rounded-full" : "rounded-[10px]"
      } ${className}`}
      {...props}
    >
      <Icon size={16} />
    </button>
  );
}
