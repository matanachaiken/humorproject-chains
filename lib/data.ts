import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/dal";
import type { Step } from "@/lib/chains";

export type Chain = {
  id: number;
  name: string;
  purpose: string;
  description: string | null;
  steps: Step[];
};

type ChainRow = Omit<Chain, "steps"> & { prompt_chain_steps: Step[] };

// Only studio chains can be changed. Daily Riff calls the others' steps by
// number, so editing them here could take the live site down.
export const isEditable = (chain: Pick<Chain, "purpose">) => chain.purpose === "studio";

// Cached per request, so the tabs layout and the page share one query.
export const getChain = cache(async (rawId: string): Promise<Chain> => {
  const { db } = await requireAdmin();
  const id = Number(rawId);
  if (!Number.isSafeInteger(id)) notFound();

  const { data, error } = await db
    .from("prompt_chains")
    .select("id, name, purpose, description, prompt_chain_steps (id, step_order, name, kind, prompt_template)")
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<ChainRow | null, { merge: false }>();
  if (error) throw error;
  if (!data) notFound();

  const { prompt_chain_steps: steps, ...chain } = data;
  return { ...chain, steps: [...steps].sort((a, b) => a.step_order - b.step_order) };
});
