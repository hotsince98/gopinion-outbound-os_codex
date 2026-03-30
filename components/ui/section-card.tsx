import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: Readonly<{
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}>) {
  return (
    <section className={cn("surface-panel overflow-hidden", className)}>
      <div className="flex flex-col gap-4 border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] px-6 py-5 lg:flex-row lg:items-start lg:justify-between lg:px-7 lg:py-6">
        <div className="max-w-2xl">
          <p className="text-[1.02rem] font-medium tracking-[-0.01em] text-copy">{title}</p>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
          ) : null}
        </div>

        {action ? <div className="shrink-0 self-start">{action}</div> : null}
      </div>

      <div className={cn("px-6 py-6 lg:px-7 lg:py-7", contentClassName)}>
        {children}
      </div>
    </section>
  );
}
