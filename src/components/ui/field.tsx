export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3.5 mb-1.5 text-[10px] font-medium tracking-[0.1em] text-linen-ink-tertiary uppercase">
      {children}
    </div>
  );
}

export function InputField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-[11px] border-none bg-linen-field px-3.5 py-3 text-sm text-linen-ink placeholder:text-[#B0A898] focus:outline-none"
    />
  );
}

export function TextAreaField(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="min-h-16 w-full resize-none rounded-[11px] border-none bg-linen-field px-3.5 py-3 text-[13px] text-linen-ink placeholder:text-[#B0A898] focus:outline-none"
    />
  );
}

export function DimensionsField({
  width,
  depth,
  height,
  onChange,
}: {
  width: string;
  depth: string;
  height: string;
  onChange: (dims: { width: string; depth: string; height: string }) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={width}
          onChange={(e) => onChange({ width: e.target.value, depth, height })}
          placeholder="W"
          aria-label="Width, cm"
          className="min-w-0 flex-1 rounded-[11px] bg-linen-field py-3 text-center text-sm text-linen-ink placeholder:text-[#B0A898] focus:outline-none"
        />
        <span className="shrink-0 text-[13px] text-[#B0A898]">×</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={depth}
          onChange={(e) => onChange({ width, depth: e.target.value, height })}
          placeholder="D"
          aria-label="Depth, cm"
          className="min-w-0 flex-1 rounded-[11px] bg-linen-field py-3 text-center text-sm text-linen-ink placeholder:text-[#B0A898] focus:outline-none"
        />
        <span className="shrink-0 text-[13px] text-[#B0A898]">×</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={height}
          onChange={(e) => onChange({ width, depth, height: e.target.value })}
          placeholder="H"
          aria-label="Height, cm"
          className="min-w-0 flex-1 rounded-[11px] bg-linen-field py-3 text-center text-sm text-linen-ink placeholder:text-[#B0A898] focus:outline-none"
        />
      </div>
      <div className="mt-1 text-right text-[10px] text-linen-ink-tertiary">
        width × depth × height, cm
      </div>
    </div>
  );
}
