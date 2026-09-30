import { NextResponse } from "next/server";
import pool from "@/database/db";
import { getSessionUserId, unauthorizedResponse } from "@/lib/auth/session";

const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884d8",
    "#82ca9d",
    "#ffc658",
    "#ff7300",
];

export async function GET() {
    const userId = await getSessionUserId();
    if (!userId) {
        return unauthorizedResponse();
    }

    try {
        const query = `
      SELECT
        category,
        SUM(amount) as value
      FROM expenses
      WHERE userid = $1
      AND type = 'expense'
      AND date >= date_trunc('month', CURRENT_DATE)
      GROUP BY category
      ORDER BY value DESC
    `;

        const result = await pool.query(query, [userId]);
        const data = result.rows.map((row, index) => ({
            name: row.category,
            value: Number(row.value),
            fill: COLORS[index % COLORS.length],
        }));

        return NextResponse.json({ success: true, data }, { status: 200 });
    } catch (error) {
        console.error("Error fetching spending by category:", error);
        return NextResponse.json(
            { success: false, message: "Error fetching spending by category", error: String(error) },
            { status: 500 }
        );
    }
}
