"use server";

import pool from "@/database/db";
import { withoutPassword } from "@/lib/auth/public-user";
import { getSessionUserId } from "@/lib/auth/session";



export async function getUserData() {
    try {
        const userId = await getSessionUserId();
        if (!userId) {
            throw new Error("Unauthorized");
        }

        const query = "SELECT * FROM users WHERE id = $1";
        const result = await pool.query(query, [userId]);

        if (result.rows.length === 0) {
            throw new Error("User not found");
        }

        return withoutPassword(result.rows[0]);
    } catch (error) {
        console.error("Error fetching user data:", error);
        throw error;
    }
}

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
