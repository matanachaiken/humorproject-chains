"use client";

import { useFormStatus } from "react-dom";

// Disabled while its form's action runs.
export function ActionButton({
  label,
  className,
  disabled = false,
  children,
}: {
  label: string;
  className: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button aria-label={label} title={label} disabled={disabled || pending} className={className}>
      {children}
    </button>
  );
}

export function DeleteForm({
  action,
  confirmText,
  label,
}: {
  action: () => Promise<void>;
  confirmText: string;
  label: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmText)) event.preventDefault();
      }}
    >
      <ActionButton label={label} className="text-sm font-medium text-bad hover:underline disabled:opacity-60">
        {label}
      </ActionButton>
    </form>
  );
}
