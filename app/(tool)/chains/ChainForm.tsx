"use client";

import { useTransition, useState, type FormEvent } from "react";
import { Field, inputClass, primaryButton } from "../ui";
import type { FormState } from "./actions";

// Used to create and to edit. Submitting from onSubmit keeps what was typed
// if saving fails, which a plain form action would clear.
export default function ChainForm({
  action,
  initial,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial: { name: string; description: string };
  submitLabel: string;
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<FormState>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    start(async () => setState(await action(null, formData)));
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name">
        <input name="name" required maxLength={120} defaultValue={initial.name} className={inputClass} />
      </Field>
      <Field label="Description" hint="Optional. What this chain is for.">
        <textarea name="description" rows={2} maxLength={500} defaultValue={initial.description} className={inputClass} />
      </Field>
      <div className="flex items-center gap-4">
        <button disabled={pending} className={primaryButton}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <p role="status" className="text-sm">
          {state?.error && <span className="text-bad">{state.error}</span>}
          {state?.saved && !pending && <span className="text-good">Saved.</span>}
        </p>
      </div>
    </form>
  );
}
