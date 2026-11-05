import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getChain, isEditable } from "@/lib/data";
import { chainNeeds } from "@/lib/chains";
import RunForm from "./RunForm";

export const metadata: Metadata = { title: "Generate" };

// advanceRun runs here. One step can try every text model in turn.
export const maxDuration = 120;

export default async function RunPage({ params }: PageProps<"/chains/[id]/run">) {
  const { id } = await params;
  const chain = await getChain(id);
  if (!isEditable(chain)) redirect(`/chains/${chain.id}`);

  return <RunForm chainId={chain.id} needs={chainNeeds(chain.steps)} stepCount={chain.steps.length} />;
}
