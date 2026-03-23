import { SidebarNav } from "@/components/layout/sidebar-nav";
import { navigationItems } from "@/lib/navigation";

export function AppShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative min-h-screen bg-ink text-copy">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(111,202,255,0.08),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.05),transparent_22%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-[1680px] flex-col lg:flex-row">
        <aside className="border-b border-white/8 bg-white/[0.03] px-4 py-4 lg:min-h-screen lg:w-[304px] lg:border-b-0 lg:border-r lg:px-6 lg:py-6">
          <div className="surface-panel px-5 py-5">
            <p className="eyebrow">GoPinion</p>
            <h1 className="mt-3 text-xl font-semibold tracking-tight text-copy">
              Outbound OS
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Dealer-first outbound operations for lead qualification, outreach,
              booking, and learning.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted">
                V1
              </span>
              <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-copy">
                Email-first
              </span>
            </div>
          </div>

          <SidebarNav items={navigationItems} />

          <div className="surface-panel mt-6 hidden p-5 lg:block">
            <p className="micro-label">System posture</p>
            <p className="mt-3 text-sm leading-6 text-muted">
              Mock-backed UI, modular boundaries, and no production integrations
              yet. The next build step is schema and data modeling.
            </p>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-white/8 bg-ink/80 backdrop-blur-2xl">
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
              <div>
                <p className="eyebrow">Outbound Operating System</p>
                <p className="mt-2 text-sm text-muted">
                  Built for scanning, action, and clean handoff between UI and
                  business logic.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted">
                  Independent dealers
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted">
                  Reviews first
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted">
                  Book 5 per day
                </span>
              </div>
            </div>
          </header>

          <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
