import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FilterPanel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: Readonly<{
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}>) {
  return (
    <section className={cn("surface-panel overflow-hidden", className)}>
      {title || description || action ? (
        <div className="panel-header-quiet flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-start lg:justify-between lg:px-7 lg:py-6">
          <div className="max-w-2xl">
            {title ? <p className="text-base font-medium tracking-[-0.01em] text-copy">{title}</p> : null}
            {description ? (
              <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
            ) : null}
          </div>

          {action ? <div className="shrink-0 self-start">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn("px-6 py-6 lg:px-7 lg:py-7", bodyClassName)}>{children}</div>
    </section>
  );
}
