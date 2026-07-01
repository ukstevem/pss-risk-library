"use client";

import Link from "next/link";

const nav = [
  { href: "/", label: "Assess" },
  { href: "/capture", label: "Register" },
  { href: "/seed", label: "Seed" },
];

export function AppSidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-white/10 bg-[#061b37] text-white p-4">
      <div className="font-semibold mb-6">Risk Library</div>
      <nav className="flex flex-col gap-1">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="px-3 py-2 rounded hover:bg-white/10 text-sm"
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
