import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { config as appConfig } from "@/lib/config";

const APP_PREFIXES = ["/home", "/library", "/add", "/items", "/collections", "/practice", "/find", "/journal", "/profile"];

/**
 * In Supabase mode: refreshes the auth session cookie and sends signed-out
 * visitors of app routes to /auth. Data access itself is protected by RLS.
 * In local mode there is no account, so this is a no-op.
 */
export async function proxy(request: NextRequest) {
  if (appConfig.dataMode !== "supabase") return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  if (!signedIn && APP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|data/|icons/|.*\\.(?:png|jpg|svg|webp|json)$).*)"],
};
