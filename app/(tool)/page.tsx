import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { EmptyState, primaryButton } from "./ui";

export const metadata: Metadata = { title: "Prompt chains" };

type Row = {
  id: number;
  name: string;
  purpose: string;
  description: string | null;
  prompt_chain_steps: { count: number }[];
  prompt_chain_runs: { count: number }[];
};

export default async function ChainsPage() {
  const { db } = await requireAdmin();
  const { data, error } = await db
    .from("prompt_chains")
    .select("id, name, purpose, description, prompt_chain_steps (count), prompt_chain_runs (count)")
    .order("id", { ascending: false })
    .overrideTypes<Row[], { merge: false }>();
  if (error) throw error;

  const studio = data.filter((c) => c.purpose === "studio");
  const live = data.filter((c) => c.purpose !== "studio").reverse();

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prompt chains</h1>
          <p className="mt-1 text-sm text-ink-2">
            A chain is a list of prompts where each step can use what the last one wrote.
          </p>
        </div>
        <Link href="/chains/new" className={primaryButton}>
          New chain
        </Link>
      </header>

      {studio.length ? (
        <ul className="space-y-3">
          {studio.map((c) => (
            <ChainRow key={c.id} chain={c} />
          ))}
        </ul>
      ) : (
        <EmptyState>No chains yet. Make one to get started.</EmptyState>
      )}

      <h2 className="mb-1 mt-10 font-semibold">Used by Daily Riff</h2>
      <p className="mb-3 text-sm text-ink-2">
        The live site runs these, so you can view them and their media but not change them.
      </p>
      <ul className="space-y-3">
        {live.map((c) => (
          <ChainRow key={c.id} chain={c} />
        ))}
      </ul>
    </>
  );
}

function ChainRow({ chain }: { chain: Row }) {
  const steps = chain.prompt_chain_steps[0]?.count ?? 0;
  const runs = chain.prompt_chain_runs[0]?.count ?? 0;
  return (
    <li>
      <Link
        href={`/chains/${chain.id}`}
        className="block rounded-xl border border-line bg-surface px-5 py-4 hover:border-axis"
      >
        <span className="flex flex-wrap items-baseline justify-between gap-x-4">
          <span className="font-semibold">{chain.name}</span>
          <span className="text-xs text-muted">
            {steps} {steps === 1 ? "step" : "steps"}
            {chain.purpose === "studio" && ` · ${runs} ${runs === 1 ? "run" : "runs"}`}
          </span>
        </span>
        {chain.description && <span className="mt-1 block text-sm text-ink-2">{chain.description}</span>}
      </Link>
    </li>
  );
}
