"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { RunView } from "@/lib/runs";
import { Field, inputClass, primaryButton, StatusBadge, EmptyState } from "../../../ui";
import StepOutput from "../StepOutput";
import { advanceRun, startRun } from "./actions";

export default function RunForm({
  chainId,
  needs,
  stepCount,
}: {
  chainId: number;
  needs: { text: boolean; image: boolean };
  stepCount: number;
}) {
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<RunView | null>(null);
  const [busy, setBusy] = useState(false);

  async function pickImage(file: File | undefined) {
    setImageError(null);
    if (image) URL.revokeObjectURL(image.url);
    setImage(null);
    if (!file) return;
    try {
      const blob = await toJpeg(file);
      setImage({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setImageError("That file couldn't be read as an image.");
    }
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (needs.image && !image) {
      setImageError("Choose an image.");
      return;
    }
    if (image) formData.set("image", image.blob, "upload.jpg");

    setBusy(true);
    setError(null);
    setRun(null);
    try {
      const started = await startRun(chainId, formData);
      if ("error" in started) {
        setError(started.error);
        return;
      }
      let current = started.run;
      setRun(current);
      while (current.status === "running") {
        const { run: next, advanced } = await advanceRun(current.id);
        current = next;
        setRun(next);
        if (!advanced) break;
      }
      if (current.status === "running") setError("The run stopped partway. Try generating again.");
    } catch {
      setError("Lost the connection during this run. Check the Media tab, then try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!stepCount) return <EmptyState>Add a step before generating.</EmptyState>;

  // The step in progress: the server only reports back once it has finished.
  const activeId = busy ? run?.steps.find((s) => s.status === "pending")?.id : undefined;

  return (
    <>
      <form onSubmit={generate} className="space-y-4 rounded-xl border border-line bg-surface p-5">
        {needs.image && (
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="file">
              Image
            </label>
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex aspect-square w-32 items-center justify-center overflow-hidden rounded-lg border border-dashed border-line bg-surface-2 text-xs text-muted">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local preview blob
                  <img src={image.url} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  "No image yet"
                )}
              </div>
              <div className="min-w-0 text-sm text-ink-2">
                {/* No name: the converted JPEG is added on submit instead. */}
                <input
                  id="file"
                  type="file"
                  accept="image/*"
                  onChange={(e) => pickImage(e.target.files?.[0])}
                  className="block max-w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:font-medium file:text-ink hover:file:bg-line"
                />
                <p className="mt-2 text-xs text-muted">Any image type. It&apos;s resized to 1024px and saved as JPEG.</p>
                {imageError && <p className="mt-2 text-sm text-bad">{imageError}</p>}
              </div>
            </div>
          </div>
        )}
        {needs.text && (
          <Field label="Input" hint="Fills in {{input}} in the prompts.">
            <textarea name="input" required rows={3} maxLength={5000} className={inputClass} />
          </Field>
        )}
        {!needs.text && !needs.image && (
          <p className="text-sm text-ink-2">This chain doesn&apos;t need any input.</p>
        )}
        <div className="flex items-center gap-4">
          <button disabled={busy} className={primaryButton}>
            {busy ? "Generating…" : "Generate"}
          </button>
          <p role="status" className="text-sm text-bad">
            {error}
          </p>
        </div>
      </form>

      {run && (
        <ol className="mt-6 space-y-3" aria-live="polite">
          {run.steps.map((step) => (
            <li key={step.id} className="rounded-xl border border-line bg-surface px-5 py-4">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-sm font-semibold">
                  {step.position}. {step.name}
                </p>
                <StatusBadge
                  status={
                    step.id === activeId
                      ? "running"
                      : step.status === "pending" && run.status === "failed"
                        ? "skipped"
                        : step.status
                  }
                />
              </div>
              <StepOutput step={step} />
            </li>
          ))}
        </ol>
      )}
      {run?.status === "succeeded" && (
        <p className="mt-4 text-sm">
          <Link href={`/chains/${chainId}/media`} className="font-medium underline underline-offset-4">
            See all media from this chain
          </Link>
        </p>
      )}
    </>
  );
}

async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  // JPEG has no transparency, so paint transparent areas white.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.88)
  );
}
