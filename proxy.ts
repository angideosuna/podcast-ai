// Proxy de Next.js: refresca la sesión de Supabase, protege rutas y valida CSRF

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { shouldBlockRequest } from "@/lib/csrf";

export async function proxy(request: NextRequest) {
  // CSRF check on mutating API requests
  if (shouldBlockRequest(
    request.nextUrl.pathname,
    request.method,
    request.nextUrl.host,
    request.headers.get("origin")
  )) {
    return NextResponse.json(
      { error: "Forbidden: cross-origin request blocked" },
      { status: 403 }
    );
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refrescar la sesion (importante para mantener el token actualizado)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Rutas protegidas: redirigir a login si no hay sesion
  const protectedPaths = ["/dashboard", "/historial", "/perfil", "/podcast"];
  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Si el usuario esta logueado y va a login/signup, redirigir al dashboard
  if (
    user &&
    (request.nextUrl.pathname === "/login" ||
      request.nextUrl.pathname === "/signup")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Ejecutar en todas las rutas excepto archivos estaticos y _next
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
