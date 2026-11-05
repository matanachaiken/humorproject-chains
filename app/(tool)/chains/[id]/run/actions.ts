"use server";

import { requireAdmin } from "@/lib/dal";
import { getChain, isEditable } from "@/lib/data";
import { chainNeeds } from "@/lib/chains";
import { loadRun, removeImages, runNextStep, saveImage, toRunView, type RunView } from "@/lib/runs";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export type StartResult = { error: string } | { run: RunView };

// Saves the run and a copy of the chain's steps. The browser then calls
// advanceRun until it's finished.
export async function startRun(chainId: number, formData: FormData): Promise<StartResult> {
  const { db, viewer } = await requireAdmin();
  const chain = await getChain(String(chainId));
  if (!isEditable(chain)) return { error: "Daily Riff runs this chain itself." };
  if (!chain.steps.length) return { error: "Add a step first." };

  const needs = chainNeeds(chain.steps);
  const input_text = String(formData.get("input") ?? "").trim();
  if (input_text.length > 5000) return { error: "The input must be under 5,000 characters." };
  if (needs.text && !input_text) return { error: "This chain needs some input text." };

  const image = formData.get("image");
  const hasImage = image instanceof File && image.size > 0;
  if (needs.image && !hasImage) return { error: "This chain starts from an image. Choose one." };
  if (hasImage && image.type !== "image/jpeg") return { error: "The image must be a JPEG." };
  if (hasImage && image.size > MAX_IMAGE_BYTES) return { error: "The image must be under 4 MB." };

  let input_image_path: string | null = null;
  if (needs.image && hasImage) {
    try {
      input_image_path = await saveImage(db, chain.id, image);
    } catch (error) {
      console.error("Upload failed:", error);
      return { error: "Couldn't upload the image. Please try again." };
    }
  }

  const { data: run, error } = await db
    .from("prompt_chain_runs")
    .insert({ chain_id: chain.id, created_by: viewer.id, input_text, input_image_path })
    .select("id")
    .single();
  const { error: stepsError } = run
    ? await db.from("prompt_chain_run_steps").insert(
        chain.steps.map((s, i) => ({
          run_id: run.id,
          step_id: s.id,
          position: i + 1,
          name: s.name,
          kind: s.kind,
          prompt: s.prompt_template,
        }))
      )
    : { error: null };
  if (!run || error || stepsError) {
    console.error("Starting a run failed:", error ?? stepsError);
    if (run) await db.from("prompt_chain_runs").delete().eq("id", run.id);
    if (input_image_path) await removeImages(db, [input_image_path]);
    return { error: "Couldn't start the run. Please try again." };
  }

  return { run: toRunView((await loadRun(db, run.id))!) };
}

// Runs the next step. `advanced` is false when there was nothing to run.
export async function advanceRun(runId: number): Promise<{ run: RunView; advanced: boolean }> {
  const { db } = await requireAdmin();
  const run = await loadRun(db, runId);
  if (!run) throw new Error("That run doesn't exist anymore.");
  const advanced = await runNextStep(db, run);
  return { run: toRunView(advanced ? (await loadRun(db, runId))! : run), advanced };
}
