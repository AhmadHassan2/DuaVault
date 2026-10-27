import { BookOpen, Home, NotebookPen, Plus, Search, Sparkles, User, FolderHeart } from "lucide-react";

export const PRIMARY_NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: BookOpen },
  { href: "/add", label: "Add", icon: Plus, emphasized: true },
  { href: "/practice", label: "Practice", icon: Sparkles },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export const SECONDARY_NAV = [
  { href: "/find", label: "Find what you need", icon: Search },
  { href: "/collections", label: "Collections", icon: FolderHeart },
  { href: "/journal", label: "Journal", icon: NotebookPen },
] as const;

export function isActive(pathname: string, href: string): boolean {
  if (href === "/library") return pathname.startsWith("/library") || pathname.startsWith("/items");
  return pathname === href || pathname.startsWith(`${href}/`);
}
