"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { config } from "@/lib/config";
import { PRIMARY_NAV, SECONDARY_NAV, isActive } from "./nav-items";
import { Wordmark } from "./logo";
import { ReminderNotifier } from "@/components/reminders/reminder-notifier";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <ReminderNotifier />
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar px-4 py-6 lg:flex">
        <Link href="/home" className="px-2">
          <Wordmark />
        </Link>
        <Suspense fallback={<SidebarNav pathname="" />}>
          <SidebarNavLive />
        </Suspense>
        <div className="mt-auto px-3 text-xs leading-relaxed text-muted-foreground">
          {config.dataMode === "local"
            ? "Stored privately on this device. Nothing is uploaded."
            : "Synced to your private account."}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <Suspense fallback={<BottomNav pathname="" />}>
        <BottomNavLive />
      </Suspense>
    </div>
  );
}

// The current path is request data, so the active-state navs stream in under
// <Suspense>; the fallback is the same nav with nothing highlighted.
function SidebarNavLive() {
  return <SidebarNav pathname={usePathname()} />;
}

function BottomNavLive() {
  return <BottomNav pathname={usePathname()} />;
}

function navLinkClass(active: boolean) {
  return cn(
    "flex items-center gap-3 rounded-md px-3 py-2 text-[0.94rem] transition-colors",
    active
      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
  );
}

function SidebarNav({ pathname }: { pathname: string }) {
  return (
    <nav className="mt-8 flex flex-col gap-0.5" aria-label="Main">
      {PRIMARY_NAV.map(({ href, label, icon: Icon, ...rest }) => {
        const active = isActive(pathname, href);
        const emphasized = "emphasized" in rest;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(navLinkClass(active), emphasized && !active && "font-medium text-primary")}
          >
            <Icon className="size-4" strokeWidth={emphasized ? 2.2 : 1.8} />
            {emphasized ? "Add new" : label}
          </Link>
        );
      })}
      <div className="mx-3 my-3 h-px bg-sidebar-border" />
      {SECONDARY_NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={navLinkClass(active)}>
            <Icon className="size-4" strokeWidth={1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-background lg:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5 px-2 pt-2 pb-1">
        {PRIMARY_NAV.map(({ href, label, icon: Icon, ...rest }) => {
          const active = isActive(pathname, href);
          const emphasized = "emphasized" in rest;
          return (
            <li key={href} className="flex justify-center">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={emphasized ? "Add new" : undefined}
                className={cn(
                  "flex min-w-14 flex-col items-center gap-1 py-1 text-[11px] transition-colors",
                  active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {emphasized ? (
                  <span className="grid h-[22px] w-9 place-items-center rounded-md bg-primary text-primary-foreground">
                    <Icon className="size-4" strokeWidth={2.4} />
                  </span>
                ) : (
                  <Icon className="size-[22px]" strokeWidth={active ? 2 : 1.6} />
                )}
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
