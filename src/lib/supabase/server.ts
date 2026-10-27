import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { config } from "@/lib/config";

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(config.supabaseUrl, config.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — the proxy refreshes sessions instead.
        }
      },
    },
  });
}
