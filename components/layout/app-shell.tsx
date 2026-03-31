import { SidebarNav } from "@/components/layout/sidebar-nav";
import { navigationItems } from "@/lib/navigation";

export function AppShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative min-h-screen bg-ink text-copy">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(126,188,255,0.08),transparent_26%),radial-gradient(circle_at_90%_0%,rgba(255,255,255,0.035),transparent_18%),radial-gradient(circle_at_50%_100%,rgba(126,188,255,0.05),transparent_24%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
        <aside className="shell-rail border-b border-white/8 px-4 py-4 lg:min-h-screen lg:w-[292px] lg:border-b-0 lg:border-r lg:px-5 lg:py-5">
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
              <span className="pill-shell">
                V1
              </span>
              <span className="pill-shell-accent">
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
          <header className="shell-header sticky top-0 z-20">
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-7 xl:px-9">
              <div>
                <p className="eyebrow">Outbound Operating System</p>
                <p className="mt-2 text-sm text-muted">
                  Built for scanning, action, and clean handoff between UI and
                  business logic.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="pill-shell">
                  Independent dealers
                </span>
                <span className="pill-shell">
                  Reviews first
                </span>
                <span className="pill-shell">
                  Book 5 per day
                </span>
              </div>
            </div>
          </header>

          <main className="flex-1 px-5 py-6 lg:px-7 lg:py-8 xl:px-9 xl:py-9">{children}</main>
        </div>
      </div>
    </div>
  );
}
