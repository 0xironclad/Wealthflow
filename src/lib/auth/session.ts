import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@/utils/superbase/server";
import { SESSION_USER_ID_HEADER } from "@/lib/auth/session-header";

// Returns the signed-in user's id, or null.
// Never trust a userId supplied by the client (query string / body) instead of this.
//
// Middleware (src/utils/superbase/middleware.ts) already verifies the
// session with supabase.auth.getUser() on every matched request (its
// matcher covers all pages and API routes) and forwards the verified id via
// a header it always sets itself, stripping any incoming copy first. Read
// that header instead of calling getUser() again here, and only fall back
// to it for a request middleware didn't run for.
export async function getSessionUserId(): Promise<string | null> {
    const headerList = await headers();
    const headerUserId = headerList.get(SESSION_USER_ID_HEADER);
    if (headerUserId) {
        return headerUserId;
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    return user?.id ?? null;
}

export function unauthorizedResponse() {
    return NextResponse.json(
        {
            success: false,
            message: "Unauthorized",
        },
        { status: 401 }
    );
}
