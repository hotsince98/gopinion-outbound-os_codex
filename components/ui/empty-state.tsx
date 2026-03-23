export function EmptyState({
  eyebrow,
  title,
  description,
}: Readonly<{
  eyebrow?: string;
  title: string;
  description: string;
}>) {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
      <div className="max-w-md">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <p className="mt-3 text-xl font-medium tracking-tight text-copy">{title}</p>
        <p className="mt-3 text-sm leading-7 text-muted">{description}</p>
      </div>
    </div>
  );
}
