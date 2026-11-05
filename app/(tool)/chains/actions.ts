"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/dal";
import { isStepKind, placeholders } from "@/lib/chains";
import { removeImages } from "@/lib/runs";

// Server actions are public endpoints, so each one checks for an admin itself
// instead of trusting the page. Daily Riff's chains can have their wording
// edited, but anything that changes their structure needs a studio chain.

export type FormState = { error?: string; saved?: boolean } | null;

const NOT_EDITABLE = "Daily Riff uses this chain, so it can't be changed here.";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

function readChain(formData: FormData) {
  const name = text(formData, "name");
  const description = text(formData, "description");
  if (!name || name.length > 120) return { error: "Name must be 1–120 characters." };
  if (description.length > 500) return { error: "Description must be under 500 characters." };
  return { fields: { name, description: description || null } };
}

function readStep(formData: FormData) {
  const name = text(formData, "name");
  const kind = text(formData, "kind");
  const prompt_template = text(formData, "prompt_template");
  if (!name || name.length > 120) return { error: "Step name must be 1–120 characters." };
  if (!isStepKind(kind)) return { error: "Pick a step type." };
  if (!prompt_template || prompt_template.length > 20000) return { error: "Prompt must be 1–20,000 characters." };
  return { fields: { name, kind, prompt_template } };
}

type StepRow = { kind: string; prompt_template: string; prompt_chains: { purpose: string } | null };

async function isStudioChain(db: SupabaseClient, chainId: number) {
  const { data } = await db.from("prompt_chains").select("purpose").eq("id", chainId).maybeSingle();
  return data?.purpose === "studio";
}

// The step, if it belongs to a studio chain.
async function studioStep(db: SupabaseClient, stepId: number) {
  const { data } = await db.from("prompt_chain_steps").select("id, chain_id").eq("id", stepId).maybeSingle();
  return data && (await isStudioChain(db, data.chain_id)) ? (data as { id: number; chain_id: number }) : null;
}

async function stepIds(db: SupabaseClient, chainId: number) {
  const { data, error } = await db
    .from("prompt_chain_steps")
    .select("id")
    .eq("chain_id", chainId)
    .order("step_order");
  if (error) throw error;
  return data.map((s) => s.id as number);
}

function setOrder(db: SupabaseClient, chainId: number, ids: number[]) {
  return db.rpc("set_prompt_chain_step_order", { p_chain_id: chainId, p_step_ids: ids });
}

export async function createChain(_prev: FormState, formData: FormData): Promise<FormState> {
  const { db } = await requireAdmin();
  const { fields, error } = readChain(formData);
  if (!fields) return { error };

  const { data, error: insertError } = await db
    .from("prompt_chains")
    .insert({ ...fields, purpose: "studio", slug: `studio-${randomUUID()}` })
    .select("id")
    .single();
  if (insertError) {
    console.error("Creating a chain failed:", insertError);
    return { error: "Couldn't create the chain. Please try again." };
  }
  redirect(`/chains/${data.id}`);
}

export async function updateChain(chainId: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const { db } = await requireAdmin();
  const { fields, error } = readChain(formData);
  if (!fields) return { error };

  const { error: updateError } = await db.from("prompt_chains").update(fields).eq("id", chainId);
  if (updateError) {
    console.error("Updating a chain failed:", updateError);
    return { error: "Couldn't save the chain. Please try again." };
  }
  refresh();
  return { saved: true };
}

// Removes the chain with its steps and runs (they cascade), then their images.
export async function deleteChain(chainId: number) {
  const { db } = await requireAdmin();
  if (!(await isStudioChain(db, chainId))) throw new Error(NOT_EDITABLE);

  const { data: runs } = await db
    .from("prompt_chain_runs")
    .select("input_image_path, prompt_chain_run_steps (output_image_path)")
    .eq("chain_id", chainId);

  const { error } = await db.from("prompt_chains").delete().eq("id", chainId);
  if (error) {
    console.error("Deleting a chain failed:", error);
    throw new Error("Couldn't delete the chain.");
  }

  const paths = (runs ?? []).flatMap((r) => [
    r.input_image_path as string | null,
    ...(r.prompt_chain_run_steps as { output_image_path: string | null }[]).map((s) => s.output_image_path),
  ]);
  await removeImages(db, paths.filter((p) => p !== null));
  redirect("/");
}

export async function addStep(chainId: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const { db } = await requireAdmin();
  if (!(await isStudioChain(db, chainId))) return { error: NOT_EDITABLE };
  const { fields, error } = readStep(formData);
  if (!fields) return { error };

  const ids = await stepIds(db, chainId);
  const { error: insertError } = await db
    .from("prompt_chain_steps")
    .insert({ ...fields, chain_id: chainId, step_order: ids.length + 1 });
  if (insertError) {
    console.error("Adding a step failed:", insertError);
    return { error: "Couldn't add the step. Please try again." };
  }
  refresh();
  return { saved: true };
}

export async function updateStep(stepId: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const { db } = await requireAdmin();
  const { data: step } = await db
    .from("prompt_chain_steps")
    .select("kind, prompt_template, prompt_chains (purpose)")
    .eq("id", stepId)
    .maybeSingle()
    .overrideTypes<StepRow | null, { merge: false }>();
  if (!step) return { error: "That step doesn't exist anymore." };

  // Daily Riff fills in these placeholders and expects each step's type.
  const live = step.prompt_chains?.purpose !== "studio";
  if (live) formData.set("kind", step.kind);
  const { fields, error } = readStep(formData);
  if (!fields) return { error };
  if (live) {
    const required = placeholders(step.prompt_template);
    if (required.join() !== placeholders(fields.prompt_template).join()) {
      return {
        error: required.length
          ? `Daily Riff needs exactly these placeholders: ${required.join(", ")}.`
          : "Daily Riff doesn't fill in placeholders on this step, so remove them.",
      };
    }
  }

  const { error: updateError } = await db.from("prompt_chain_steps").update(fields).eq("id", stepId);
  if (updateError) {
    console.error("Updating a step failed:", updateError);
    return { error: "Couldn't save the step. Please try again." };
  }
  refresh();
  return { saved: true };
}

// Later steps move up so the numbers stay 1..n. Past runs keep their own copy
// of the step.
export async function deleteStep(stepId: number) {
  const { db } = await requireAdmin();
  const step = await studioStep(db, stepId);
  if (!step) throw new Error(NOT_EDITABLE);

  const { error } = await db.from("prompt_chain_steps").delete().eq("id", stepId);
  if (error) {
    console.error("Deleting a step failed:", error);
    throw new Error("Couldn't delete the step.");
  }
  const { error: orderError } = await setOrder(db, step.chain_id, await stepIds(db, step.chain_id));
  if (orderError) console.error("Renumbering after a delete failed:", orderError);
  refresh();
}

// Swaps a step with the one above (-1) or below (1) it.
export async function moveStep(stepId: number, direction: -1 | 1) {
  const { db } = await requireAdmin();
  const step = await studioStep(db, stepId);
  if (!step) throw new Error(NOT_EDITABLE);

  const ids = await stepIds(db, step.chain_id);
  const from = ids.indexOf(stepId);
  const to = from + (direction === -1 ? -1 : 1);
  if (to < 0 || to >= ids.length) return;
  [ids[from], ids[to]] = [ids[to], ids[from]];

  const { error } = await setOrder(db, step.chain_id, ids);
  if (error) {
    console.error("Reordering failed:", error);
    throw new Error("Couldn't reorder the steps.");
  }
  refresh();
}
