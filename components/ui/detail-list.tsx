export interface DetailListItem {
  label: string;
  value: string;
}

export function DetailList({
  items,
  columns = 2,
}: Readonly<{
  items: DetailListItem[];
  columns?: 1 | 2;
}>) {
  return (
    <div
      className={
        columns === 2
          ? "grid gap-3 sm:grid-cols-2"
          : "grid gap-3"
      }
    >
      {items.map((item) => (
        <div key={item.label} className="surface-muted p-4">
          <p className="micro-label">{item.label}</p>
          <p className="mt-3 text-sm leading-6 text-copy">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
