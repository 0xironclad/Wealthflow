"use server";

import pool from "@/database/db";
import { getSessionUserId } from "@/lib/auth/session";



export async function getUserData() {
    try {
        const userId = await getSessionUserId();
        if (!userId) {
            throw new Error("Unauthorized");
        }

        const query =
            "SELECT id, email, name, fullname, avatar_url, is_email_verified, last_login, created_at, updated_at FROM users WHERE id = $1";
        const result = await pool.query(query, [userId]);

        if (result.rows.length === 0) {
            throw new Error("User not found");
        }

        return result.rows[0];
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
      RETURNING id, email, name, fullname, avatar_url, is_email_verified, last_login, created_at, updated_at
    `;
        const result = await pool.query(query, [
            data.fullname,
            data.avatarUrl,
            userId,
        ]);

        return result.rows[0];
    } catch (error) {
        console.error("Error updating user:", error);
        throw error;
    }
}
