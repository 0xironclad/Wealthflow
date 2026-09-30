import { NextResponse } from "next/server";
import pool from "@/database/db";
import { BudgetSchema, UpdateBudgetSchema } from "@/lib/schemas/budget-schema";
import { getSessionUserId, unauthorizedResponse } from "@/lib/auth/session";

// get budgets
export async function GET(request: Request) {
    try {
        const userId = await getSessionUserId();
        if (!userId) {
            return unauthorizedResponse();
        }

        const url = new URL(request.url)
        const getTotal = url.searchParams.get('total') === 'true'
        const fromDate = url.searchParams.get('from')
        const toDate = url.searchParams.get('to')

        if (getTotal) {
            // Handle total budget calculation
            let dateCondition = ''
            const dateParams = [userId]

            if (fromDate && toDate) {
                // Custom date range
                const from = new Date(fromDate).toISOString()
                const to = new Date(toDate).toISOString()
                dateCondition = `AND (
                    (start_date <= $2 AND end_date >= $2) OR
                    (start_date <= $3 AND end_date >= $3) OR
                    (start_date >= $2 AND end_date <= $3)
                )`
                dateParams.push(from, to)
            } else if (fromDate || toDate) {
                // Single date boundary
                if (fromDate) {
                    const from = new Date(fromDate).toISOString()
                    dateCondition = 'AND end_date >= $2'
                    dateParams.push(from)
                }
                if (toDate) {
                    const to = new Date(toDate).toISOString()
                    const paramIndex = dateParams.length + 1
                    dateCondition += (dateCondition ? ' AND ' : 'AND ') + `start_date <= $${paramIndex}`
                    dateParams.push(to)
                }
            } else {
                // Default to current month if no dates provided
                const now = new Date()
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()
                dateCondition = `AND (
                    (start_date <= $2 AND end_date >= $2) OR
                    (start_date <= $3 AND end_date >= $3) OR
                    (start_date >= $2 AND end_date <= $3)
                )`
                dateParams.push(startOfMonth, endOfMonth)
            }

            const query = `
                SELECT
                    SUM(planned_amount) as total_planned,
                    SUM(spent_amount) as total_spent,
                    COUNT(*) as budget_count
                FROM budgets
                WHERE user_id = $1 ${dateCondition}
            `

            const result = await pool.query(query, dateParams)

            return NextResponse.json({
                success: true,
                data: {
                    totalPlanned: parseFloat(result.rows[0].total_planned) || 0,
                    totalSpent: parseFloat(result.rows[0].total_spent) || 0,
                    budgetCount: parseInt(result.rows[0].budget_count) || 0,
                    remaining: (parseFloat(result.rows[0].total_planned) || 0) - (parseFloat(result.rows[0].total_spent) || 0),
                    dateRange: {
                        from: fromDate,
                        to: toDate
                    }
                }
            }, { status: 200 })
        }

        // Existing logic for getting all budgets with optional period filtering
        let query = 'SELECT * FROM budgets WHERE user_id = $1'
        const queryParams = [userId]

        // Add period filtering if from/to dates are provided
        if (fromDate && toDate) {
            const from = new Date(fromDate).toISOString()
            const to = new Date(toDate).toISOString()
            query += ` AND (
                (start_date <= $2 AND end_date >= $2) OR
                (start_date <= $3 AND end_date >= $3) OR
                (start_date >= $2 AND end_date <= $3)
            ) ORDER BY start_date DESC`
            queryParams.push(from, to)
        } else {
            query += ' ORDER BY start_date DESC'
        }

        const result = await pool.query(query, queryParams)
        return NextResponse.json(
            {
                success: true,
                data: result.rows,
            },
            { status: 200 }
        )
    } catch (error) {
        return NextResponse.json({
            success: false,
            message: "Error fetching budgets",
            error: String(error)
        }, { status: 500 })
    }
}


export async function POST(request: Request) {
    try {
        const userId = await getSessionUserId();
        if (!userId) {
            return unauthorizedResponse();
        }

        const body = await request.json()
        const { error } = BudgetSchema.safeParse(body)
        if (error) {
            return NextResponse.json({
                success: false,
                message: "Invalid budget data",
                error
            }, { status: 400 })
        }
        const query = 'INSERT INTO budgets (user_id, name, description, period_type, start_date, end_date, category, planned_amount, spent_amount, is_rollover) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *'
        const result = await pool.query(query, [
            userId,
            body.name,
            body.description,
            body.periodType,
            body.startDate,
            body.endDate,
            body.category,
            body.plannedAmount,
            body.spentAmount,
            body.rollOver
        ])

        return NextResponse.json({
            success: true,
            message: "Budget created successfully",
            data: result.rows[0]
        })
    } catch (error) {
        console.error('Error creating budget:', error)
        return NextResponse.json({
            success: false,
            message: "Failed to create budget",
            error
        }, { status: 500 })
    }
}
export async function PUT(request: Request) {
    try {
        const userId = await getSessionUserId();
        if (!userId) {
            return unauthorizedResponse();
        }

        const body = await request.json()
        const { error } = UpdateBudgetSchema.safeParse(body)
        if (error) {
            return NextResponse.json({
                success: false,
                message: "Invalid budget data",
                error
            }, { status: 400 })
        }
        const query = 'UPDATE budgets SET name = $1, description = $2, period_type = $3, start_date = $4, end_date = $5, category = $6, planned_amount = $7, spent_amount = $8, is_rollover = $9 WHERE id = $10 AND user_id = $11 RETURNING *'
        const result = await pool.query(query, [body.name, body.description, body.periodType, body.startDate, body.endDate, body.category, body.plannedAmount, body.spentAmount, body.rollover, body.id, userId])
        if (result.rows.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Budget not found"
            }, { status: 404 })
        }
        return NextResponse.json({
            success: true,
            data: result.rows[0]
        }, { status: 200 })

    } catch (error) {
        return NextResponse.json({
            success: false,
            message: "Error updating budget",
            error: String(error)
        }, { status: 500 })
    }
}


export async function DELETE(request: Request) {
    try {
        const userId = await getSessionUserId();
        if (!userId) {
            return unauthorizedResponse();
        }

        const url = new URL(request.url)
        const id = url.searchParams.get('id')
        const query = "delete from budgets where id = $1 and user_id = $2 returning *"
        const result = await pool.query(query, [id, userId])
        if (result.rows.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Budget not found"
            }, { status: 404 })
        }
        return NextResponse.json({
            success: true,
            data: result.rows[0]
        }, { status: 200 })

    } catch (error) {
        return NextResponse.json({
            success: false,
            message: "Error deleting budget",
            error: String(error)
        }, { status: 500 })
    }
}
