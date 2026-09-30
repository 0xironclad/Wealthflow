import { NextResponse } from "next/server";
import pool from "@/database/db";
import { getSessionUserId, unauthorizedResponse } from "@/lib/auth/session";

export async function GET() {
    const userId = await getSessionUserId();
    if (!userId) {
        return unauthorizedResponse();
    }

    try {
        const savingsQuery = `
            WITH monthly_stats AS (
                SELECT
                    date_trunc('month', date) as month,
                    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
                FROM (
                    SELECT date, amount, 'income' as type FROM incomes WHERE userid = $1
                    UNION ALL
                    SELECT date, amount, 'expense' as type FROM expenses WHERE userid = $1 AND type = 'expense'
                ) t
                WHERE date >= date_trunc('month', CURRENT_DATE - INTERVAL '3 months')
                GROUP BY 1
            )
            SELECT
                AVG(CASE WHEN income > 0 THEN (income - expense) / income ELSE 0 END) * 100 as savings_rate,
                AVG(expense) as avg_monthly_expense
            FROM monthly_stats
        `;

        // Total balance = incomes - expenses + withdrawals
        const balanceQuery = `
      WITH balance_calc AS (
        SELECT
          COALESCE((SELECT SUM(amount) FROM incomes WHERE userid = $1), 0) as total_income,
          COALESCE((SELECT SUM(amount) FROM expenses WHERE userid = $1 AND (type = 'expense')), 0) as total_expense,
          COALESCE((SELECT SUM(amount) FROM expenses WHERE userid = $1 AND type = 'withdrawal'), 0) as total_withdrawal
      )
      SELECT (total_income - total_expense + total_withdrawal) as balance
      FROM balance_calc
    `;

        // Independent queries: run them together instead of one after the other.
        const [savingsResult, balanceResult] = await Promise.all([
            pool.query(savingsQuery, [userId]),
            pool.query(balanceQuery, [userId]),
        ]);

        const savingsRate = Number(savingsResult.rows[0]?.savings_rate || 0);
        const avgMonthlyExpense = Number(savingsResult.rows[0]?.avg_monthly_expense || 0);
        const totalBalance = Number(balanceResult.rows[0]?.balance || 0);

        // Runway = how many months you can survive on current balance if income stops
        const runwayMonths = avgMonthlyExpense > 0 ? totalBalance / avgMonthlyExpense : 0;

        // Savings Rate (50%): Target 20% = 100pts
        const savingsScore = Math.min((savingsRate / 20) * 100, 100);

        // Runway (30%): Target 6 months = 100pts
        const runwayScore = Math.min((runwayMonths / 6) * 100, 100);

        // Budget Adherence (20%): Simplified as (1 - overspend_rate)
        // Expense Ratio: < 80% of income = good. Target expense ratio 80%
        // (meaning 20% savings). If expense ratio > 100%, score 0.
        const expenseRatio = 100 - savingsRate;
        const budgetScore =
            expenseRatio <= 80 ? 100 : Math.max(0, 100 - (expenseRatio - 80) * 5);

        const totalScore = Math.round(
            savingsScore * 0.5 + runwayScore * 0.3 + budgetScore * 0.2
        );

        const data = {
            score: totalScore,
            savingsRate: Math.round(savingsRate),
            runwayMonths: Number(runwayMonths.toFixed(1)),
            grade:
                totalScore >= 80
                    ? "Excellent"
                    : totalScore >= 60
                        ? "Good"
                        : totalScore >= 40
                            ? "Fair"
                            : "Needs Improvement",
        };

        return NextResponse.json({ success: true, data }, { status: 200 });
    } catch (error) {
        console.error("Error calculating financial health:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Error calculating financial health",
                error: String(error),
            },
            { status: 500 }
        );
    }
}
