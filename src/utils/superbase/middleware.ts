import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_USER_ID_HEADER } from "@/lib/auth/session-header";

export async function updateSession(request: NextRequest) {
    // Strip any client-supplied copy first, on every request, so the header can't be spoofed.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete(SESSION_USER_ID_HEADER);

    // Refreshed cookies, applied to the single response built below.
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
        // Verified above; lets handlers skip their own getUser() call.
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
