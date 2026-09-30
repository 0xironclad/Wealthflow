import { NextResponse } from "next/server";
import { createClient } from "@/utils/superbase/server";

// Returns the signed-in user's id from the Supabase session, or null.
// Never trust a userId supplied by the client (query string / body) instead of this.
export async function getSessionUserId(): Promise<string | null> {
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
