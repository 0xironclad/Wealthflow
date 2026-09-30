import { NextResponse } from "next/server";
import pool from "@/database/db";
import { getSessionUserId, unauthorizedResponse } from "@/lib/auth/session";

interface CategoryTrendData {
    month: string;
    [category: string]: number | string;
}

export async function GET() {
    const userId = await getSessionUserId();
    if (!userId) {
        return unauthorizedResponse();
    }

    try {
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

        if (topCategories.length === 0) {
            return NextResponse.json(
                { success: true, data: { data: [], categories: [] } },
                { status: 200 }
            );
        }

        // Depends on topCategories above, so this can't be parallelized with it.
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
        const data = {
            data: trendsResult.rows.map((row) => {
                const newRow: CategoryTrendData = { month: row.month };
                topCategories.forEach((cat) => {
                    newRow[cat] = Number(row[cat]);
                });
                return newRow;
            }),
            categories: topCategories,
        };

        return NextResponse.json({ success: true, data }, { status: 200 });
    } catch (error) {
        console.error("Error fetching category trends:", error);
        return NextResponse.json(
            { success: false, message: "Error fetching category trends", error: String(error) },
            { status: 500 }
        );
    }
}
