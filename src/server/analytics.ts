"use server";

import pool from "@/database/db";
import { getSessionUserId } from "@/lib/auth/session";

export const getMonthlyCashFlow = async (): Promise<
    { name: string; income: number; expense: number }[]
> => {
    try {
        const userId = await getSessionUserId();
        if (!userId) {
            return [];
        }

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
        return result.rows.map((row) => ({
            name: row.name,
            income: Number(row.income),
            expense: Number(row.expense),
        }));
    } catch (error) {
        console.error("Error fetching cash flow:", error);
        return [];
    }
};

export const getSpendingByCategory = async (): Promise<
    { name: string; value: number; fill: string }[]
> => {
    try {
        const userId = await getSessionUserId();
        if (!userId) {
            return [];
        }

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

        return result.rows.map((row, index) => ({
            name: row.category,
            value: Number(row.value),
            fill: COLORS[index % COLORS.length],
        }));
    } catch (error) {
        console.error("Error fetching spending by category:", error);
        return [];
    }
};

export const getFinancialHealth = async () => {
    try {
        const userId = await getSessionUserId();
        if (!userId) {
            return { score: 0, savingsRate: 0, runwayMonths: 0, grade: "N/A" };
        }

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
        const savingsResult = await pool.query(savingsQuery, [userId]);
        const savingsRate = Number(savingsResult.rows[0]?.savings_rate || 0);
        const avgMonthlyExpense = Number(
            savingsResult.rows[0]?.avg_monthly_expense || 0
        );

        // Calculate total balance (liquid funds) instead of savings
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
        const balanceResult = await pool.query(balanceQuery, [userId]);
        const totalBalance = Number(balanceResult.rows[0]?.balance || 0);

        // Runway = how many months you can survive on current balance if income stops
        const runwayMonths =
            avgMonthlyExpense > 0 ? totalBalance / avgMonthlyExpense : 0;

        // 3. Calculate Score
        // Savings Rate (50%): Target 20% = 100pts
        const savingsScore = Math.min((savingsRate / 20) * 100, 100);

        // Runway (30%): Target 6 months = 100pts
        const runwayScore = Math.min((runwayMonths / 6) * 100, 100);

        // Budget Adherence (20%): Simplified as (1 - overspend_rate)
        // Let's use a simpler proxy: Expense Ratio. < 80% of income = good.
        // Target expense ratio 80% (meaning 20% savings).
        // If expense ratio > 100%, score 0.
        const expenseRatio = 100 - savingsRate;
        const budgetScore =
            expenseRatio <= 80 ? 100 : Math.max(0, 100 - (expenseRatio - 80) * 5);

        const totalScore = Math.round(
            savingsScore * 0.5 + runwayScore * 0.3 + budgetScore * 0.2
        );

        return {
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
    } catch (error) {
        console.error("Error calculating financial health:", error);
        return { score: 0, savingsRate: 0, runwayMonths: 0, grade: "N/A" };
    }
};

interface CategoryTrendData {
    month: string;
    [category: string]: number | string;
}

export const getCategoryTrends = async (): Promise<
    { data: CategoryTrendData[]; categories: string[] }
> => {
    try {
        const userId = await getSessionUserId();
        if (!userId) {
            return { data: [], categories: [] };
        }

        const topCategoriesQuery = `
            SELECT category
            FROM expenses
            WHERE userid = $1
            AND type = 'expense'
            AND date >= date_trunc('month', CURRENT_DATE - INTERVAL '5 months')
            GROUP BY category
            ORDER BY SUM(amount) DESC
            LIMIT 3
        `;
        const topCategoriesResult = await pool.query(topCategoriesQuery, [userId]);
        const topCategories = topCategoriesResult.rows.map((r) => r.category);

        if (topCategories.length === 0) return { data: [], categories: [] };

        const trendsQuery = `
            WITH months AS (
                SELECT generate_series(
                    date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
                    date_trunc('month', CURRENT_DATE),
                    '1 month'::interval
                ) as month
            )
            SELECT
                to_char(m.month, 'Mon') as month,
                ${topCategories
                .map(
                    (cat) => `
                    COALESCE(SUM(CASE WHEN e.category = '${cat}' THEN e.amount ELSE 0 END), 0) as "${cat}"
                `
                )
                .join(",")}
            FROM months m
            LEFT JOIN expenses e ON date_trunc('month', e.date) = m.month
                AND e.userid = $1
                AND e.type = 'expense'
                AND e.category IN (${topCategories
                .map((c) => `'${c}'`)
                .join(",")})
            GROUP BY m.month
            ORDER BY m.month ASC
        `;

        const trendsResult = await pool.query(trendsQuery, [userId]);
        return {
            data: trendsResult.rows.map((row) => {
                const newRow: CategoryTrendData = { month: row.month };
                topCategories.forEach((cat) => {
                    newRow[cat] = Number(row[cat]);
                });
                return newRow;
            }),
            categories: topCategories,
        };
    } catch (error) {
        console.error("Error fetching category trends:", error);
        return { data: [], categories: [] };
    }
};
