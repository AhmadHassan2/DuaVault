const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function relativeTime(iso: string, now: Date = new Date()): string {
  const diff = (new Date(iso).getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), "month");
  return rtf.format(Math.round(diff / (86400 * 365)), "year");
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Peaceful night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
