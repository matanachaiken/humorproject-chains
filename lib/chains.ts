// Chain rules shared by the server and the browser.

export const STEP_KINDS = {
  vision: { label: "Image → text", hint: "Reads the run's latest image and writes text." },
  text: { label: "Text → text", hint: "Sends this prompt to a text model." },
  image: { label: "Text → image", hint: "Draws an image from this prompt." },
} as const;
export type StepKind = keyof typeof STEP_KINDS;

export function isStepKind(value: string): value is StepKind {
  return Object.hasOwn(STEP_KINDS, value);
}

export type Step = {
  id: number;
  step_order: number;
  name: string;
  kind: StepKind;
  prompt_template: string;
};

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

// Each distinct placeholder in a template, like "{{theme}}", sorted.
export function placeholders(template: string) {
  return [...new Set(template.match(PLACEHOLDER) ?? [])].sort();
}

// Fills {{name}} placeholders. Unknown ones are left as-is so they're easy to spot.
export function render(template: string, vars: Record<string, string>) {
  return template.replace(PLACEHOLDER, (match, name: string) => vars[name] ?? match);
}

// Problems a step's template would hit at its position in the chain. Worth
// showing after every reorder, since moving a step can break {{step_N}}.
export function checkTemplate(template: string, position: number) {
  const warnings = new Set<string>();
  for (const [token, name] of template.matchAll(PLACEHOLDER)) {
    const earlier = name.match(/^step_(\d+)$/);
    if (earlier) {
      if (Number(earlier[1]) >= position) warnings.add(`${token} hasn't run yet when step ${position} runs.`);
    } else if (name === "previous") {
      if (position === 1) warnings.add(`${token} is empty in step 1, because nothing has run yet.`);
    } else if (name !== "input") {
      warnings.add(`${token} isn't a placeholder this tool fills in.`);
    }
  }
  return [...warnings];
}

// What the Generate form has to ask for.
export function chainNeeds(steps: Pick<Step, "kind" | "prompt_template">[]) {
  const firstVision = steps.findIndex((s) => s.kind === "vision");
  const firstImage = steps.findIndex((s) => s.kind === "image");
  return {
    text: steps.some((s) => /\{\{input\}\}/.test(s.prompt_template)),
    // A step that draws earlier in the chain supplies the image instead.
    image: firstVision !== -1 && (firstImage === -1 || firstVision < firstImage),
  };
}

// Run images live in Daily Riff's public bucket.
export function imageUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/generations/${path}`;
}
