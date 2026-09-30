import { NextResponse } from "next/server";
import { createClient } from "@/utils/superbase/server";

// The signed-in user's id, or null. Never use a client-supplied userId instead.
// Always verified with Supabase: request headers can't be trusted, since middleware isn't
// guaranteed to run (the root middleware.ts isn't picked up while the app lives in src/).
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
