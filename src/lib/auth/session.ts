import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@/utils/superbase/server";
import { SESSION_USER_ID_HEADER } from "@/lib/auth/session-header";

// The signed-in user's id, or null. Never use a client-supplied userId instead.
// Middleware verifies the session and forwards the id in a header it always strips first;
// fall back to getUser() when middleware didn't run.
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
