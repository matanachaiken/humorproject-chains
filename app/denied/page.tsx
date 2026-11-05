import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/dal";
import { getTheme } from "@/lib/theme";
import ThemeSwitcher from "../ThemeSwitcher";

export const metadata: Metadata = { title: "Not authorized" };

export default async function DeniedPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.isAdmin) redirect("/");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="fixed right-4 top-4">
        <ThemeSwitcher initial={await getTheme()} />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">Daily Riff</p>
        <h1 className="mt-1 text-2xl font-bold">Not authorized</h1>
        <p className="mt-2 text-sm text-ink-2">
          You&apos;re signed in as <span className="font-medium text-ink">{viewer.email}</span>,
          but this account doesn&apos;t have admin access.
        </p>
        <form action="/auth/signout" method="post" className="mt-6">
          <button className="w-full rounded-lg border border-line px-5 py-3 font-semibold hover:bg-surface-2">
            Sign out and switch accounts
          </button>
        </form>
      </div>
    </main>
  );
}
