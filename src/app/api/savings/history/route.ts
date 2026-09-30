import pool from "@/database/db";
import { NextResponse } from "next/server";
import { getSessionUserId, unauthorizedResponse } from "@/lib/auth/session";

export async function GET() {
    const userId = await getSessionUserId();
    if (!userId) {
        return unauthorizedResponse();
    }

    try {
        const query = `
      WITH tx AS (
        SELECT
          s.name,
          date_trunc('month', sh.date) AS month,
          sh.amount::numeric AS amount,
          sh.type
        FROM savings_history sh
        JOIN savings s ON sh.saving_id = s.id
        WHERE s.userid = $1
      ),
      monthly AS (
        SELECT
          name,
          month,
          SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END) AS deposits,
          SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END) AS withdrawals,
          SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END) AS net
        FROM tx
        GROUP BY name, month
      ),
      cumulative AS (
        SELECT
          name,
          month,
          deposits,
          withdrawals,
          net,
          SUM(net) OVER (PARTITION BY name ORDER BY month ROWS UNBOUNDED PRECEDING) AS cumulative_balance
        FROM monthly
      )
      SELECT
        name,
        to_char(month, 'YYYY-MM-01') AS month,
        deposits::float,
        withdrawals::float,
        net::float,
        cumulative_balance::float
      FROM cumulative
      ORDER BY month ASC, name ASC
    `;
        const { rows } = await pool.query(query, [userId]);
        return NextResponse.json(rows, { status: 200 });
    } catch (error) {
        console.error("Error fetching savings history:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
