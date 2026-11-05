import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Calls the same AI providers as Daily Riff, using the models configured in
// llm_models, and logs every attempt to llm_responses so it shows up in the
// admin area.

export type CallContext = { db: SupabaseClient; chainId: number; stepId: number | null };

type LogRow = {
  provider: string;
  model: string;
  prompt: string;
  latency_ms: number;
  status: "ok" | "error";
  response?: string;
  error?: string;
};

async function log(ctx: CallContext, row: LogRow) {
  const { error } = await ctx.db
    .from("llm_responses")
    .insert({ ...row, chain_id: ctx.chainId, step_id: ctx.stepId });
  if (error) console.warn("Couldn't log the AI call:", error);
}

type ModelRow = { model_key: string; kind: string; llm_providers: { slug: string; is_active: boolean } | null };

async function getModels(db: SupabaseClient) {
  const { data, error } = await db
    .from("llm_models")
    .select("model_key, kind, llm_providers (slug, is_active)")
    .eq("is_active", true)
    .order("priority")
    .order("id")
    .overrideTypes<ModelRow[], { merge: false }>();
  if (error) throw new Error("Couldn't read the model list.");
  const usable = data.filter((m) => m.llm_providers?.is_active);
  return {
    text: usable.filter((m) => m.kind === "text" && m.llm_providers?.slug === "google").map((m) => m.model_key),
    image: usable.find((m) => m.kind === "image" && m.llm_providers?.slug === "cloudflare")?.model_key,
  };
}

// Tries each active Gemini model in priority order: free-tier models are
// often overloaded or out of quota. Pass an image for a vision step.
export async function generateText(prompt: string, image: Buffer | null, ctx: CallContext) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const { text: models } = await getModels(ctx.db);
  if (!models.length) throw new Error("No active text models. Check Models in the admin area.");

  const input = image
    ? [
        { type: "text", text: prompt },
        { type: "image", data: image.toString("base64"), mime_type: "image/jpeg" },
      ]
    : prompt;
  const logged = image ? `${prompt}\n\n[image attached]` : prompt;

  const errors: string[] = [];
  for (const model of models) {
    const started = Date.now();
    const fail = async (message: string) => {
      errors.push(message);
      await log(ctx, { provider: "google", model, prompt: logged, status: "error", error: message, latency_ms: Date.now() - started });
    };

    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ model, input }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    }).catch((error: Error) => error);
    if (res instanceof Error) {
      await fail(res.message);
      continue;
    }

    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.error) {
      await fail(`${res.status} ${data?.error?.message ?? ""}`.trim());
      continue;
    }

    type Output = { type: string; content?: { type: string; text?: string }[] };
    const reply = (data.steps as Output[] | undefined)
      ?.filter((s) => s.type === "model_output")
      .flatMap((s) => s.content ?? [])
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("")
      .trim();
    if (!reply) {
      await fail("no text in response");
      continue;
    }

    await log(ctx, { provider: "google", model, prompt: logged, response: reply, status: "ok", latency_ms: Date.now() - started });
    return { text: reply, model };
  }

  if (errors.every((e) => /^(429|503)\b/.test(e))) {
    throw new Error("Every text model is out of quota or overloaded right now. Try again later.");
  }
  throw new Error(`All text models failed: ${errors.join(" | ")}`);
}

// Draws with the first active Cloudflare image model and returns JPEG bytes.
export async function generateImage(prompt: string, ctx: CallContext) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) throw new Error("CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is not set");
  const { image: model } = await getModels(ctx.db);
  if (!model) throw new Error("No active image model. Check Models in the admin area.");

  const started = Date.now();
  const finish = (row: Pick<LogRow, "status" | "response" | "error">) =>
    log(ctx, { provider: "cloudflare", model, prompt, latency_ms: Date.now() - started, ...row });

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: 6 }),
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const body = await res.text();
    await finish({ status: "error", error: `${res.status}: ${body.slice(0, 300)}` });
    // 8007 is Workers AI's "Input prompt contains NSFW content".
    if (body.includes('"code":8007')) throw new Error("The image model's safety filter blocked this prompt.");
    throw new Error(`The image model returned an error (${res.status}).`);
  }

  const data = await res.json();
  const base64: string | undefined = data.result?.image ?? data.image;
  if (!base64) {
    await finish({ status: "error", error: "no image in response" });
    throw new Error("The image model returned no image.");
  }
  const image = Buffer.from(base64, "base64");
  await finish({ status: "ok", response: `[JPEG image, ${Math.round(image.length / 1024)} KB]` });
  return { image, model };
}
