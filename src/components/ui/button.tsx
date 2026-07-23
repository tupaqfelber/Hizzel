export function GhostButton({
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`flex-1 rounded-xl border border-linen-border py-3.5 text-center text-sm font-medium text-linen-ink-secondary disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}

export function SolidButton({
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      className={`flex-1 rounded-xl bg-linen-ink py-3.5 text-center text-sm font-medium text-linen disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}
