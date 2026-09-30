import { NextResponse } from "next/server";
import pool from "@/database/db";
import { IncomeSchema } from "@/lib/schemas/income-schema";
import { getSessionUserId, unauthorizedResponse } from "@/lib/auth/session";

// Get all the incomes from the database
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
            // Handle total income calculation
            let dateCondition = ''
            const dateParams = [userId]

            if (fromDate && toDate) {
                // Custom date range
                dateCondition = 'AND date >= $2 AND date <= $3'
                dateParams.push(fromDate, toDate)
            } else if (fromDate || toDate) {
                // Single date boundary
                if (fromDate) {
                    dateCondition = 'AND date >= $2'
                    dateParams.push(fromDate)
                }
                if (toDate) {
                    const paramIndex = dateParams.length + 1
                    dateCondition += (dateCondition ? ' AND ' : 'AND ') + `date <= $${paramIndex}`
                    dateParams.push(toDate)
                }
            } else {
                // Default to current month if no dates provided
                const now = new Date()
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
                dateCondition = 'AND date >= $2 AND date <= $3'
                dateParams.push(startOfMonth, endOfMonth)
            }

            const query = `
                SELECT
                    SUM(amount) as total_income,
                    COUNT(*) as income_count,
                    AVG(amount) as average_income
                FROM incomes
                WHERE userid = $1 ${dateCondition}
            `

            const result = await pool.query(query, dateParams)

            return NextResponse.json({
                success: true,
                data: {
                    totalIncome: parseFloat(result.rows[0].total_income) || 0,
                    incomeCount: parseInt(result.rows[0].income_count) || 0,
                    averageIncome: parseFloat(result.rows[0].average_income) || 0,
                    dateRange: {
                        from: fromDate,
                        to: toDate
                    }
                }
            }, { status: 200 })
        }

        // Existing logic for getting all incomes with optional date filtering
        let query = 'SELECT * FROM incomes WHERE userid = $1'
        const queryParams = [userId]

        // Add date filtering if from/to dates are provided
        if (fromDate && toDate) {
            query += ' AND date >= $2 AND date <= $3 ORDER BY date DESC'
            queryParams.push(fromDate, toDate)
        } else if (fromDate) {
            query += ' AND date >= $2 ORDER BY date DESC'
            queryParams.push(fromDate)
        } else if (toDate) {
            query += ' AND date <= $2 ORDER BY date DESC'
            queryParams.push(toDate)
        } else {
            query += ' ORDER BY date DESC'
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
            message: "Error fetching incomes",
            error: String(error)
        }, { status: 500 })
    }
}


// Add a new income to the database
export async function POST(request: Request) {
    try {
        const userId = await getSessionUserId();
        if (!userId) {
            return unauthorizedResponse();
        }

        const body = await request.json()
        const { error } = IncomeSchema.safeParse(body)
        if (error) {
            return NextResponse.json({
                success: false,
                message: "Invalid income data",
                error
            }, { status: 400 })
        }
        const query = 'INSERT INTO incomes (userid, name, date, amount, category, source, isrecurring, recurringfrequency) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *'
        const result = await pool.query(query, [userId, body.name, body.date, body.amount, body.category, body.source, body.isRecurring, body.recurringFrequency])
        return NextResponse.json({
            success: true,
            data: result.rows[0]
        }, { status: 201 })
    } catch (error) {
        return NextResponse.json({
            success: false,
            message: "Error adding income",
            error
        }, { status: 500 })
    }
}
