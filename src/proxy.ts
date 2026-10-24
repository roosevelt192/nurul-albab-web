import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

const destinationByRole = {
  super_admin: "/dashboard",
  bendahara: "/keuangan",
  staf: "/keilmuan",
  wali_santri: "/portal-wali",
} as const;

export async function proxy(request: NextRequest) {
  const { url, key } = getSupabasePublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Unable to validate Supabase session:", error.message);
  }

  const isProtectedRoute = request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/santri") ||
    request.nextUrl.pathname.startsWith("/keilmuan") ||
    request.nextUrl.pathname.startsWith("/perizinan") ||
    request.nextUrl.pathname.startsWith("/keuangan") ||
    request.nextUrl.pathname.startsWith("/koperasi") ||
    request.nextUrl.pathname.startsWith("/portal-wali") ||
    request.nextUrl.pathname.startsWith("/pengaturan");

  if (isProtectedRoute && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  if ((isProtectedRoute || request.nextUrl.pathname === "/login") && user) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Unable to verify account access:", profileError.message);
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) console.error("Unable to clear session after profile verification failed.", signOutError.message);
      if (request.nextUrl.pathname === "/login") {
        const errorUrl = new URL(request.url);
        errorUrl.searchParams.set("profile_error", "1");
        const errorResponse = NextResponse.redirect(errorUrl);
        response.cookies.getAll().forEach((cookie) => errorResponse.cookies.set(cookie));
        return errorResponse;
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("profile_error", "1");
      const errorResponse = NextResponse.redirect(loginUrl);
      response.cookies.getAll().forEach((cookie) => errorResponse.cookies.set(cookie));
      return errorResponse;
    }

    if (!profile || !profile.is_active || !Object.hasOwn(destinationByRole, profile.role)) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) console.error("Unable to clear session for an inactive or invalid profile.", signOutError.message);
      if (request.nextUrl.pathname === "/login") return response;
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("approval", "pending");
      const redirectResponse = NextResponse.redirect(loginUrl);
      response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
      return redirectResponse;
    }

    if (request.nextUrl.pathname.startsWith("/pengaturan") && profile.role !== "super_admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url), {
        headers: response.headers,
      });
    }

    if (request.nextUrl.pathname === "/login") {
      return NextResponse.redirect(new URL(destinationByRole[profile.role], request.url), {
        headers: response.headers,
      });
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/santri/:path*",
    "/keilmuan/:path*",
    "/perizinan/:path*",
    "/keuangan/:path*",
    "/koperasi/:path*",
    "/portal-wali/:path*",
    "/pengaturan/:path*",
  ],
};
