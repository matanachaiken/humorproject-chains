import type { Metadata } from "next";
import Link from "next/link";
import { getChain, isEditable } from "@/lib/data";
import { checkTemplate, placeholders, STEP_KINDS, type Step } from "@/lib/chains";
import { EmptyState } from "../../ui";
import { addStep, deleteChain, deleteStep, moveStep, updateChain, updateStep } from "../actions";
import ChainForm from "../ChainForm";
import { ActionButton, DeleteForm } from "./buttons";
import StepForm from "./StepForm";

export async function generateMetadata({ params }: PageProps<"/chains/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: (await getChain(id)).name };
}

export default async function ChainPage({ params, searchParams }: PageProps<"/chains/[id]">) {
  const { id } = await params;
  const chain = await getChain(id);
  const editable = isEditable(chain);
  // The switch on Daily Riff's chains, so their prompts can't be changed by accident.
  const unlocked = !editable && (await searchParams).edit === "1";

  return (
    <>
      {!editable && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg bg-surface-2 px-4 py-3">
          <p className="min-w-0 flex-1 basis-64 text-sm text-ink-2">
            {unlocked
              ? "Editing is on. Saved changes reach the live site within about a minute. Steps can't be added, moved or deleted, because Daily Riff calls them by number."
              : "Daily Riff runs this chain, so it's read-only until you turn on editing."}
          </p>
          <Link
            href={unlocked ? `/chains/${chain.id}` : `/chains/${chain.id}?edit=1`}
            className="shrink-0 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:border-axis"
          >
            {unlocked ? "Turn off editing" : "Turn on editing"}
          </Link>
        </div>
      )}

      {chain.steps.length ? (
        <ol className="space-y-3">
          {chain.steps.map((step, i) => (
            <StepCard
              key={step.id}
              step={step}
              position={i + 1}
              total={chain.steps.length}
              editable={editable}
              unlocked={unlocked}
            />
          ))}
        </ol>
      ) : (
        <EmptyState>No steps yet. Add the first one below.</EmptyState>
      )}

      {unlocked && (
        <section className="mt-6 rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-4 font-semibold">Chain details</h2>
          <ChainForm
            action={updateChain.bind(null, chain.id)}
            initial={{ name: chain.name, description: chain.description ?? "" }}
            submitLabel="Save details"
          />
        </section>
      )}

      {editable && (
        <>
          <section className="mt-6 rounded-xl border border-line bg-surface p-5">
            <h2 className="mb-4 font-semibold">Add a step</h2>
            <StepForm
              action={addStep.bind(null, chain.id)}
              initial={{ name: "", kind: "text", prompt_template: "" }}
              submitLabel="Add step"
              resetOnSave
            />
          </section>

          <section className="mt-6 rounded-xl border border-line bg-surface p-5">
            <h2 className="mb-4 font-semibold">Chain details</h2>
            <ChainForm
              action={updateChain.bind(null, chain.id)}
              initial={{ name: chain.name, description: chain.description ?? "" }}
              submitLabel="Save details"
            />
            <div className="mt-5 border-t border-line pt-4">
              <DeleteForm
                action={deleteChain.bind(null, chain.id)}
                confirmText={`Delete "${chain.name}" with all its steps and generated media? This can't be undone.`}
                label="Delete this chain"
              />
            </div>
          </section>
        </>
      )}
    </>
  );
}

const moveClass =
  "flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-40";

function StepCard({
  step,
  position,
  total,
  editable,
  unlocked,
}: {
  step: Step;
  position: number;
  total: number;
  editable: boolean;
  unlocked: boolean;
}) {
  const warnings = editable ? checkTemplate(step.prompt_template, position) : [];

  return (
    <li className="rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">
          {position}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{step.name}</p>
          <p className="text-xs text-muted">{STEP_KINDS[step.kind].label}</p>
        </div>
        {editable && (
          <div className="flex shrink-0 gap-1">
            <form action={moveStep.bind(null, step.id, -1)}>
              <ActionButton label={`Move step ${position} up`} className={moveClass} disabled={position === 1}>
                ↑
              </ActionButton>
            </form>
            <form action={moveStep.bind(null, step.id, 1)}>
              <ActionButton label={`Move step ${position} down`} className={moveClass} disabled={position === total}>
                ↓
              </ActionButton>
            </form>
          </div>
        )}
      </div>

      {warnings.length > 0 && (
        <ul className="border-t border-line px-4 py-2 text-xs text-warn">
          {warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}

      <details className="border-t border-line">
        <summary className="cursor-pointer px-4 py-2 text-sm text-ink-2 hover:text-ink">
          {editable || unlocked ? "Edit" : "Show prompt"}
        </summary>
        <div className="border-t border-line p-4">
          {editable || unlocked ? (
            <>
              <StepForm
                action={updateStep.bind(null, step.id)}
                initial={{ name: step.name, kind: step.kind, prompt_template: step.prompt_template }}
                submitLabel="Save step"
                lockedPlaceholders={unlocked ? placeholders(step.prompt_template) : undefined}
              />
              {editable && (
                <div className="mt-4 border-t border-line pt-3">
                  <DeleteForm
                    action={deleteStep.bind(null, step.id)}
                    confirmText={`Delete step ${position}, "${step.name}"?`}
                    label="Delete step"
                  />
                </div>
              )}
            </>
          ) : (
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-ink-2">
              {step.prompt_template}
            </pre>
          )}
        </div>
      </details>
    </li>
  );
}
