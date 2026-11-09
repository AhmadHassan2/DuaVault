import type { Metadata, Viewport } from "next";
import { Amiri, Figtree, Newsreader, Noto_Naskh_Arabic } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeScript } from "@/components/theme/theme-script";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import "./globals.css";

const ui = Figtree({ variable: "--font-ui", subsets: ["latin"] });
const display = Newsreader({ variable: "--font-display", subsets: ["latin"], style: ["normal", "italic"] });
const arabicQuran = Amiri({ variable: "--font-arabic-quran", subsets: ["arabic"], weight: ["400", "700"] });
const arabicNaskh = Noto_Naskh_Arabic({ variable: "--font-arabic-naskh", subsets: ["arabic"] });

export const metadata: Metadata = {
  title: { default: "DuaVault", template: "%s · DuaVault" },
  description: "Save the duas, verses and reminders you find online — then actually revisit, understand and practice them.",
  applicationName: "DuaVault",
  appleWebApp: { capable: true, title: "DuaVault", statusBarStyle: "default" },
  icons: { icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }], apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#dce3d6" },
    { media: "(prefers-color-scheme: dark)", color: "#101b16" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${ui.variable} ${display.variable} ${arabicQuran.variable} ${arabicNaskh.variable} h-full dark`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full">
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster position="top-center" toastOptions={{ className: "!rounded-md !border-border !bg-popover !text-popover-foreground" }} />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
