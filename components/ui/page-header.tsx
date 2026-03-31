import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: Readonly<{
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}>) {
  return (
    <section className="surface-panel overflow-hidden">
      <div className="panel-header grid gap-6 px-6 py-6 lg:px-7 lg:py-7 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div className="max-w-3xl space-y-4">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-copy sm:text-[2.7rem]">
              {title}
            </h2>
            {description ? (
              <p className="max-w-2xl text-sm leading-7 text-muted sm:text-[1.02rem]">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className="surface-soft flex flex-wrap items-center gap-3 self-start px-4 py-4 xl:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}
