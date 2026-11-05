// Small building blocks shared by the pages.

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-axis focus:ring-2 focus:ring-brand/30";

export const primaryButton =
  "rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-60";

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center text-sm text-ink-2">
      {children}
    </div>
  );
}

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Waiting", className: "text-muted" },
  running: { label: "… Running", className: "text-ink-2" },
  succeeded: { label: "✓ Done", className: "text-good" },
  failed: { label: "✕ Failed", className: "text-bad" },
  stopped: { label: "Stopped", className: "text-muted" },
  skipped: { label: "Skipped", className: "text-muted" },
};

// A word as well as a color, so status never relies on color alone.
export function StatusBadge({ status }: { status: keyof typeof STATUS }) {
  const s = STATUS[status];
  return <span className={`whitespace-nowrap text-sm font-medium ${s.className}`}>{s.label}</span>;
}
