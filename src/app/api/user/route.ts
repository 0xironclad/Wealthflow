import { NextResponse } from "next/server";
import pool from "@/database/db";
import { getSessionUserId, unauthorizedResponse } from "@/lib/auth/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorizedResponse();
  }

  try {
    const query =
      "SELECT id, email, name, fullname, avatar_url, is_email_verified, last_login, created_at, updated_at FROM users WHERE id = $1";
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching user data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

