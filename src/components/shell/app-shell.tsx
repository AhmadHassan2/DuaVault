"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { LockKeyhole, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { config } from "@/lib/config";
import { PRIMARY_NAV, SECONDARY_NAV, isActive } from "./nav-items";
import { Wordmark } from "./logo";
import { ReminderNotifier } from "@/components/reminders/reminder-notifier";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-canvas min-h-dvh">
      <ReminderNotifier />
      <a href="#main-content" className="sr-only z-50 rounded-xl bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4">Skip to content</a>
      <header className="border-b bg-sidebar pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-22 max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
          <Link href="/home" className="shrink-0"><Wordmark className="[&_svg]:size-9 [&>span]:text-2xl" /></Link>
          <Suspense fallback={<WorkspaceNavigation pathname="" />}><LiveNavigation /></Suspense>
          <div className="flex items-center gap-2">
            <Link href="/find" aria-label="Search by situation" className="flex size-11 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-muted hover:text-primary"><Search aria-hidden="true" className="size-5" /></Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <div className="border-b border-border/60">
        <div className="mx-auto flex min-h-14 max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
          <Suspense fallback={<ExploreNavigation pathname="" />}><LiveExploreNavigation /></Suspense>
          <span className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground md:inline-flex"><LockKeyhole aria-hidden="true" className="size-3.5" />{config.dataMode === "local" ? "Your library is stored on this device." : "Your library is privately synced."}</span>
        </div>
      </div>
      <main id="main-content" className="mx-auto max-w-[1440px] px-5 pt-8 pb-32 sm:px-8 lg:px-12 lg:pt-12 lg:pb-16">{children}</main>
      <Suspense fallback={<MobileNavigation pathname="" />}><LiveMobileNavigation /></Suspense>
    </div>
  );
}

function LiveNavigation() { return <WorkspaceNavigation pathname={usePathname()} />; }
function LiveExploreNavigation() { return <ExploreNavigation pathname={usePathname()} />; }
function LiveMobileNavigation() { return <MobileNavigation pathname={usePathname()} />; }

function WorkspaceNavigation({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 rounded-full border bg-background/40 p-1.5 lg:flex">
      {PRIMARY_NAV.map(({ href, label, icon: Icon, ...rest }) => {
        const active = isActive(pathname, href);
        const add = "emphasized" in rest;
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm transition-colors", add ? "bg-primary font-semibold text-primary-foreground hover:bg-primary/85" : active ? "bg-secondary font-medium text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon aria-hidden="true" className="size-4" />{add ? "Add new" : label}</Link>;
      })}
    </nav>
  );
}

function ExploreNavigation({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Explore" className="flex items-center gap-4 overflow-x-auto sm:gap-7">
      {SECONDARY_NAV.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={isActive(pathname, href) ? "page" : undefined} className={cn("inline-flex min-h-14 shrink-0 items-center gap-2 border-b-2 text-xs transition-colors sm:text-sm", isActive(pathname, href) ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}><Icon aria-hidden="true" className="size-4" />{href === "/find" ? "Find duas" : label}</Link>)}
    </nav>
  );
}

function MobileNavigation({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Main" className="safe-bottom fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-2xl border bg-sidebar shadow-xl shadow-background/60 lg:hidden">
      <ul className="grid grid-cols-5 px-2 py-2">
        {PRIMARY_NAV.map(({ href, label, icon: Icon, ...rest }) => {
          const active = isActive(pathname, href);
          const add = "emphasized" in rest;
          return <li key={href} className="flex justify-center"><Link href={href} aria-label={add ? "Add new" : undefined} aria-current={active ? "page" : undefined} className={cn("flex min-h-12 min-w-14 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[11px] transition-colors", active ? "bg-secondary font-medium text-primary" : "text-muted-foreground hover:text-foreground")}><span className={cn("grid h-7 w-10 place-items-center rounded-lg", add && "bg-primary text-primary-foreground")}><Icon aria-hidden="true" className="size-5" /></span>{label}</Link></li>;
        })}
      </ul>
    </nav>
  );
}
