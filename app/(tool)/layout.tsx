import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { getTheme } from "@/lib/theme";
import ThemeSwitcher from "../ThemeSwitcher";

// Every page in this group is admin-only. Pages and server actions check
// again with requireAdmin(), since layouts don't guard server actions.
export default async function ToolLayout({ children }: LayoutProps<"/">) {
  const { viewer } = await requireAdmin();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link href="/" className="leading-tight">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-brand">Daily Riff</span>
            <span className="block font-bold">Prompt Chains</span>
          </Link>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <ThemeSwitcher initial={await getTheme()} />
            <span className="hidden max-w-48 truncate text-sm text-ink-2 sm:block">{viewer.email}</span>
            <form action="/auth/signout" method="post">
              <button className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
