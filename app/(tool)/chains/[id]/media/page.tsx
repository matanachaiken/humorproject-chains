import type { Metadata } from "next";
import Image from "next/image";
import { requireAdmin } from "@/lib/dal";
import { getChain } from "@/lib/data";
import { imageUrl } from "@/lib/chains";
import { RUN_COLUMNS, toRunView, type RunRow, type RunView } from "@/lib/runs";
import { EmptyState, StatusBadge } from "../../../ui";
import StepOutput from "../StepOutput";

export const metadata: Metadata = { title: "Media" };

const LIMIT = 60;

type RiffRow = {
  id: number;
  created_at: string;
  generations: { id: number; caption: string; storage_path: string } | null;
};

const when = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function MediaPage({ params }: PageProps<"/chains/[id]/media">) {
  const { id } = await params;
  const { db } = await requireAdmin();
  const chain = await getChain(id);

  const [{ data: runs, error }, { data: riffs, error: riffError }] = await Promise.all([
    db
      .from("prompt_chain_runs")
      .select(RUN_COLUMNS)
      .eq("chain_id", chain.id)
      .order("created_at", { ascending: false })
      .limit(LIMIT)
      .overrideTypes<RunRow[], { merge: false }>(),
    // Daily Riff's own chains made these through the public site.
    db
      .from("generation_requests")
      .select("id, created_at, generations (id, caption, storage_path)")
      .eq("chain_id", chain.id)
      .not("generation_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(LIMIT)
      .overrideTypes<RiffRow[], { merge: false }>(),
  ]);
  if (error) throw error;
  if (riffError) throw riffError;

  const made = (riffs ?? []).filter((r) => r.generations);

  if (!runs.length && !made.length) {
    return <EmptyState>Nothing generated yet.</EmptyState>;
  }

  return (
    <>
      {runs.length > 0 && (
        <ul className="space-y-4">
          {runs.map((row) => (
            <RunCard key={row.id} run={toRunView(row)} />
          ))}
        </ul>
      )}

      {made.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {made.map((r) => (
            <li key={r.id} className="overflow-hidden rounded-xl border border-line bg-surface">
              <Image
                src={imageUrl(r.generations!.storage_path)}
                alt={r.generations!.caption}
                width={1024}
                height={1024}
                sizes="(max-width: 640px) 100vw, 280px"
                className="aspect-square w-full object-cover"
              />
              <div className="px-4 py-3">
                <p className="text-sm">{r.generations!.caption}</p>
                <p className="mt-1 text-xs text-muted">{when.format(new Date(r.created_at))}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function RunCard({ run }: { run: RunView }) {
  const last = run.steps.findLast((s) => s.outputText || s.outputImage);

  return (
    <li className="rounded-xl border border-line bg-surface px-5 py-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-xs text-muted">{when.format(new Date(run.createdAt))}</p>
        <StatusBadge status={run.stale ? "stopped" : run.status} />
      </div>

      <div className="mt-2 flex flex-wrap items-start gap-4">
        {run.inputImage && (
          <Image
            src={run.inputImage}
            alt="Uploaded for this run"
            width={1024}
            height={1024}
            sizes="96px"
            className="h-24 w-24 rounded-lg border border-line object-cover"
          />
        )}
        <div className="min-w-0 flex-1 basis-64">
          {run.inputText && <p className="text-sm text-ink-2">Input: {run.inputText}</p>}
          {run.error && <p className="text-sm text-bad">{run.error}</p>}
          {last && !run.error && <StepOutput step={last} />}
        </div>
      </div>

      <details className="mt-3 border-t border-line pt-2">
        <summary className="cursor-pointer text-sm text-ink-2 hover:text-ink">All steps</summary>
        <ol className="mt-2 space-y-4">
          {run.steps.map((step) => (
            <li key={step.id}>
              <p className="text-sm font-semibold">
                {step.position}. {step.name}
              </p>
              <p className="text-xs text-muted">{step.model ?? "Not run"}</p>
              <StepOutput step={step} />
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-muted hover:text-ink">Prompt sent</summary>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 font-mono text-xs leading-relaxed text-ink-2">
                  {step.prompt}
                </pre>
              </details>
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
}
