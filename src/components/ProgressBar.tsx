interface ProgressBarProps {
  value: number; // 0–1
  color?: string;
  label?: string;
}

export function ProgressBar({ value, color = 'var(--xp)', label }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="bar__fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
