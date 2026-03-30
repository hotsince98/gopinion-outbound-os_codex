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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
      <div className="max-w-3xl space-y-3">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 className="text-3xl font-semibold tracking-tight text-copy sm:text-[2.6rem]">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-sm leading-7 text-muted sm:text-[1.02rem]">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex flex-wrap items-center gap-3 xl:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}
