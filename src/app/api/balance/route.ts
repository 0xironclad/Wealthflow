import { NextResponse } from "next/server";
import pool from "@/database/db";
import { getSessionUserId, unauthorizedResponse } from "@/lib/auth/session";

// Total balance = incomes - expenses + withdrawals
export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    // One round trip instead of three: each SUM runs as its own scalar
    // subquery against the same row set Postgres would otherwise scan three
    // separate times.
    const query = `
      SELECT
        COALESCE((SELECT SUM(amount) FROM incomes WHERE userid = $1), 0) AS total_income,
        COALESCE((SELECT SUM(amount) FROM expenses WHERE userid = $1 AND (type = 'expense' OR type = 'saving')), 0) AS total_expense,
        COALESCE((SELECT SUM(amount) FROM expenses WHERE userid = $1 AND type = 'withdrawal'), 0) AS total_withdrawal
    `;
    const result = await pool.query(query, [userId]);
    const { total_income, total_expense, total_withdrawal } = result.rows[0];

    const totalBalance = Number(total_income) - Number(total_expense) + Number(total_withdrawal);

    return NextResponse.json(
      {
        success: true,
        data: Number(totalBalance.toFixed(2)),
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Error fetching balance",
        error: String(error),
      },
      { status: 500 }
    );
  }
}
