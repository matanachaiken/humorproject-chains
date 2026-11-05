"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Tabs({ id, canRun }: { id: number; canRun: boolean }) {
  const pathname = usePathname();
  const base = `/chains/${id}`;
  const tabs = [
    { href: base, label: "Steps" },
    ...(canRun ? [{ href: `${base}/run`, label: "Generate" }] : []),
    { href: `${base}/media`, label: "Media" },
  ];

  return (
    <nav className="my-6 flex gap-1 border-b border-line">
      {tabs.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              active ? "border-brand text-ink" : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
