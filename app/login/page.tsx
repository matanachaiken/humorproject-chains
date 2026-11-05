import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/dal";
import { getTheme } from "@/lib/theme";
import ThemeSwitcher from "../ThemeSwitcher";
import GoogleButton from "./GoogleButton";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getViewer()) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="fixed right-4 top-4">
        <ThemeSwitcher initial={await getTheme()} />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">Daily Riff</p>
        <h1 className="mt-1 text-2xl font-bold">Prompt chains</h1>
        <p className="mt-2 text-sm text-ink-2">
          Staff only. Sign in with the Google account that has admin access.
        </p>
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-sm text-bad">
            Sign-in didn&apos;t work. Please try again.
          </p>
        )}
        <div className="mt-6">
          <GoogleButton />
        </div>
      </div>
    </main>
  );
}
