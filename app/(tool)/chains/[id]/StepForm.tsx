"use client";

import { useState, useTransition, type FormEvent } from "react";
import { STEP_KINDS, type StepKind } from "@/lib/chains";
import { Field, inputClass, primaryButton } from "../../ui";
import type { FormState } from "../actions";

const HINT = (
  <>
    Use <code>{"{{input}}"}</code> for what you type when generating, <code>{"{{previous}}"}</code> for the last
    step&apos;s text, or <code>{"{{step_1}}"}</code> for a specific step.
  </>
);

export default function StepForm({
  action,
  initial,
  submitLabel,
  resetOnSave = false,
  lockedPlaceholders,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial: { name: string; kind: StepKind; prompt_template: string };
  submitLabel: string;
  resetOnSave?: boolean;
  // Set on Daily Riff's chains, whose step type and placeholders can't change.
  lockedPlaceholders?: string[];
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<FormState>(null);
  const [kind, setKind] = useState<StepKind>(initial.kind);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    start(async () => {
      const result = await action(null, formData);
      setState(result);
      if (result?.saved && resetOnSave) {
        form.reset();
        setKind(initial.kind);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className={`grid gap-4 ${lockedPlaceholders ? "" : "sm:grid-cols-[1fr_12rem]"}`}>
        <Field label="Step name">
          <input name="name" required maxLength={120} defaultValue={initial.name} className={inputClass} />
        </Field>
        {!lockedPlaceholders && (
          <Field label="Type">
            <select
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as StepKind)}
              className={inputClass}
            >
              {Object.entries(STEP_KINDS).map(([id, { label }]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <p className="text-xs text-muted">{STEP_KINDS[kind].hint}</p>
      <Field
        label="Prompt"
        hint={
          lockedPlaceholders
            ? lockedPlaceholders.length
              ? `Keep these placeholders: ${lockedPlaceholders.join(", ")}`
              : "This step takes no placeholders."
            : HINT
        }
      >
        <textarea
          name="prompt_template"
          required
          maxLength={20000}
          rows={6}
          defaultValue={initial.prompt_template}
          className={`${inputClass} font-mono`}
        />
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
