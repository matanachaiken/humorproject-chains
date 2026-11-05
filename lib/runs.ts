import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateImage, generateText, type CallContext } from "@/lib/ai";
import { render, imageUrl, type StepKind } from "@/lib/chains";

// A run works through its saved steps one at a time. The browser asks for each
// step, so it can show progress and a long chain can't hit a function timeout.

const BUCKET = "generations";

export type RunStatus = "running" | "succeeded" | "failed";

export type RunStepView = {
  id: number;
  position: number;
  name: string;
  kind: StepKind;
  prompt: string;
  status: "pending" | "running" | "succeeded" | "failed";
  outputText: string | null;
  outputImage: string | null;
  model: string | null;
  error: string | null;
  durationMs: number | null;
};

// A run with nobody driving it (the tab was closed) stays "running" forever.
const STALE_MS = 10 * 60 * 1000;

export type RunView = {
  id: number;
  status: RunStatus;
  stale: boolean;
  error: string | null;
  inputText: string;
  inputImage: string | null;
  createdAt: string;
  steps: RunStepView[];
};

type RunStepRow = {
  id: number;
  step_id: number | null;
  position: number;
  name: string;
  kind: StepKind;
  prompt: string;
  status: RunStepView["status"];
  output_text: string | null;
  output_image_path: string | null;
  model: string | null;
  error: string | null;
  duration_ms: number | null;
};

export type RunRow = {
  id: number;
  chain_id: number;
  status: RunStatus;
  error: string | null;
  input_text: string;
  input_image_path: string | null;
  created_at: string;
  prompt_chain_run_steps: RunStepRow[];
};

export const RUN_COLUMNS =
  "id, chain_id, status, error, input_text, input_image_path, created_at, prompt_chain_run_steps (id, step_id, position, name, kind, prompt, status, output_text, output_image_path, model, error, duration_ms)";

export function toRunView(run: RunRow): RunView {
  return {
    id: run.id,
    status: run.status,
    stale: run.status === "running" && Date.now() - new Date(run.created_at).getTime() > STALE_MS,
    error: run.error,
    inputText: run.input_text,
    inputImage: run.input_image_path ? imageUrl(run.input_image_path) : null,
    createdAt: run.created_at,
    steps: [...run.prompt_chain_run_steps]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        id: s.id,
        position: s.position,
        name: s.name,
        kind: s.kind,
        prompt: s.prompt,
        status: s.status,
        outputText: s.output_text,
        outputImage: s.output_image_path ? imageUrl(s.output_image_path) : null,
        model: s.model,
        error: s.error,
        durationMs: s.duration_ms,
      })),
  };
}

export async function loadRun(db: SupabaseClient, id: number) {
  const { data, error } = await db
    .from("prompt_chain_runs")
    .select(RUN_COLUMNS)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<RunRow | null, { merge: false }>();
  if (error) throw error;
  return data;
}

// Saves JPEG bytes under a new name in the images folder for this chain.
export async function saveImage(db: SupabaseClient, chainId: number, image: Buffer | File) {
  const path = `prompt-chains/${chainId}/${randomUUID()}.jpg`;
  const { error } = await db.storage.from(BUCKET).upload(path, image, { contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}

export function removeImages(db: SupabaseClient, paths: string[]) {
  return paths.length ? db.storage.from(BUCKET).remove(paths) : Promise.resolve();
}

// Runs the next pending step. Returns false if there was nothing to do.
export async function runNextStep(db: SupabaseClient, run: RunRow) {
  if (run.status !== "running") return false;
  const steps = [...run.prompt_chain_run_steps].sort((a, b) => a.position - b.position);
  const next = steps.find((s) => s.status === "pending");
  if (!next) return false;

  // Claiming it first means a double call can't run the step twice.
  const { data: claimed } = await db
    .from("prompt_chain_run_steps")
    .update({ status: "running" })
    .eq("id", next.id)
    .eq("status", "pending")
    .select("id");
  if (!claimed?.length) return false;

  const done = steps.filter((s) => s.position < next.position);
  const texts = done.filter((s) => s.output_text !== null);
  const vars: Record<string, string> = { input: run.input_text, previous: texts.at(-1)?.output_text ?? "" };
  for (const s of done) vars[`step_${s.position}`] = s.output_text ?? "";
  const prompt = render(next.prompt, vars);

  const ctx: CallContext = { db, chainId: run.chain_id, stepId: next.step_id };
  const started = Date.now();
  try {
    const output = await execute(db, run, next.kind, prompt, done, ctx);
    await db
      .from("prompt_chain_run_steps")
      .update({ ...output, prompt, status: "succeeded", duration_ms: Date.now() - started })
      .eq("id", next.id);
    if (next.position === steps.at(-1)!.position) {
      await db
        .from("prompt_chain_runs")
        .update({ status: "succeeded", finished_at: new Date().toISOString() })
        .eq("id", run.id);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "The step failed.";
    console.error(`Run ${run.id} step ${next.position} failed:`, error);
    await db
      .from("prompt_chain_run_steps")
      .update({ prompt, status: "failed", error: message, duration_ms: Date.now() - started })
      .eq("id", next.id);
    await db
      .from("prompt_chain_runs")
      .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
      .eq("id", run.id);
  }
  return true;
}

async function execute(
  db: SupabaseClient,
  run: RunRow,
  kind: StepKind,
  prompt: string,
  done: RunStepRow[],
  ctx: CallContext
) {
  if (kind === "image") {
    const { image, model } = await generateImage(prompt, ctx);
    return { output_image_path: await saveImage(db, run.chain_id, image), model };
  }

  let image: Buffer | null = null;
  if (kind === "vision") {
    // The most recent image: one drawn earlier in the chain, or else the upload.
    const path = done.findLast((s) => s.output_image_path)?.output_image_path ?? run.input_image_path;
    if (!path) throw new Error("This step reads an image, but the run doesn't have one yet.");
    const { data, error } = await db.storage.from(BUCKET).download(path);
    if (error) throw error;
    image = Buffer.from(await data.arrayBuffer());
  }
  const { text, model } = await generateText(prompt, image, ctx);
  return { output_text: text, model };
}
