import { NextResponse } from "next/server";
import pool from "@/database/db";
import { getSessionUserId, unauthorizedResponse } from "@/lib/auth/session";

export async function GET() {
    const userId = await getSessionUserId();
    if (!userId) {
        return unauthorizedResponse();
    }

    try {
        const query = `
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
          date_trunc('month', CURRENT_DATE),
          '1 month'::interval
        ) as month
      )
      SELECT
        to_char(m.month, 'Mon') as name,
        COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as expense
      FROM months m
      LEFT JOIN (
        SELECT date, amount, 'income' as type FROM incomes WHERE userid = $1
        UNION ALL
        SELECT date, amount, 'expense' as type FROM expenses WHERE userid = $1 AND type = 'expense'
      ) t ON date_trunc('month', t.date) = m.month
      GROUP BY m.month
      ORDER BY m.month ASC
    `;

        const result = await pool.query(query, [userId]);
        const data = result.rows.map((row) => ({
            name: row.name,
            income: Number(row.income),
            expense: Number(row.expense),
        }));

        return NextResponse.json({ success: true, data }, { status: 200 });
    } catch (error) {
        console.error("Error fetching cash flow:", error);
        return NextResponse.json(
            { success: false, message: "Error fetching cash flow", error: String(error) },
            { status: 500 }
        );
    }
}
