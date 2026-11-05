import type { Metadata } from "next";
import { requireAdmin } from "@/lib/dal";
import { createChain } from "../actions";
import ChainForm from "../ChainForm";

export const metadata: Metadata = { title: "New chain" };

export default async function NewChainPage() {
  await requireAdmin();
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">New chain</h1>
      <div className="rounded-xl border border-line bg-surface p-5">
        <ChainForm action={createChain} initial={{ name: "", description: "" }} submitLabel="Create chain" />
      </div>
    </>
  );
}
