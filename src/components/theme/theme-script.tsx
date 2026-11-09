export const THEME_KEY = "duavault-theme";
export const DEFAULT_THEME = "dark";

/** Applies the saved theme before first paint to avoid a light/dark flash. */
export function ThemeScript() {
  const js = `try{var t=localStorage.getItem("${THEME_KEY}")||"${DEFAULT_THEME}";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){}`;
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: js }}
    />
  );
}
