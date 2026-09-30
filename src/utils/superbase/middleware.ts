import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_USER_ID_HEADER } from "@/lib/auth/session-header";

export async function updateSession(request: NextRequest) {
    // Strip any client-supplied copy of the trusted header first, for every
    // matched request (including when there's no signed-in user below), so
    // it can never be spoofed. The matcher in middleware.ts covers every
    // page and API route, so this always runs before getSessionUserId()'s
    // header fallback would otherwise need to hit Supabase Auth itself.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete(SESSION_USER_ID_HEADER);

    // Cookies Supabase wants refreshed; applied to the final response below
    // so we only ever build one NextResponse (with the final request
    // headers already in place) instead of racing two reconstructions.
    const cookiesToApply: Array<{
        name: string;
        value: string;
        options?: Record<string, unknown>;
    }> = [];

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    cookiesToApply.push(...cookiesToSet);
                },
            },
        }
    );

    // Do not run code between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    // IMPORTANT: DO NOT REMOVE auth.getUser()

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (
        !user &&
        !request.nextUrl.pathname.startsWith("/login") &&
        !request.nextUrl.pathname.startsWith("/auth")
    ) {
        // no user, potentially respond by redirecting the user to the login page
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
    }

    if (user) {
        // Already verified above; forward it so handlers/actions can skip
        // their own getUser() call (see src/lib/auth/session.ts).
        requestHeaders.set(SESSION_USER_ID_HEADER, user.id);
    }

    const supabaseResponse = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });

    cookiesToApply.forEach(({ name, value, options }) =>
        supabaseResponse.cookies.set(name, value, options)
    );

    return supabaseResponse;
}
