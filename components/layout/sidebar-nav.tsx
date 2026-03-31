"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavigationItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function SidebarNav({
  items,
}: Readonly<{
  items: NavigationItem[];
}>) {
  const pathname = usePathname();

  return (
    <nav className="mt-6">
      <p className="eyebrow px-1">Workspace</p>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:flex-col">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group min-w-[165px] flex-1 rounded-2xl border px-4 py-3 transition duration-200 lg:min-w-0",
                isActive
                  ? "border-accent/22 bg-accent/10 text-copy"
                  : "border-white/8 bg-white/[0.025] text-muted hover:border-white/12 hover:bg-white/[0.045] hover:text-copy",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{item.title}</span>
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full transition",
                    isActive ? "bg-accent" : "bg-white/10 group-hover:bg-white/25",
                  )}
                />
              </div>
              <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
