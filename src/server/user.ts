"use server";

import pool from "@/database/db";
import { withoutPassword } from "@/lib/auth/public-user";
import { getSessionUserId } from "@/lib/auth/session";

// Reads live at GET /api/user (see src/server/user-queries.ts) so the
// browser can fetch them in parallel with other dashboard requests; server
// actions are invoked one at a time by Next.js. This file keeps only the
// mutation.

export async function updateUserProfile(
    data: {
        fullname: string;
        avatarUrl: string;
    }
) {
    try {
        const userId = await getSessionUserId();
        if (!userId) {
            throw new Error("Unauthorized");
        }

        const query = `
      UPDATE users
      SET fullname = $1,
          avatar_url = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;
        const result = await pool.query(query, [
            data.fullname,
            data.avatarUrl,
            userId,
        ]);

        return withoutPassword(result.rows[0]);
    } catch (error) {
        console.error("Error updating user:", error);
        throw error;
    }
}
