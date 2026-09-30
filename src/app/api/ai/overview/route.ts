import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import pool from "@/database/db";
import { generateFinancialOverviewPrompt } from "@/lib/prompts/financial";
import { getSessionUserId, unauthorizedResponse } from "@/lib/auth/session";

export async function GET() {
    try {
        const userId = await getSessionUserId();
        if (!userId) {
            return unauthorizedResponse();
        }

        // Four independent reads: run them together instead of one after the other.
        const [
            { rows: savings },
            { rows: expenses },
            { rows: budgets },
            { rows: income },
        ] = await Promise.all([
            pool.query('SELECT * FROM savings WHERE userid = $1', [userId]),
            pool.query('SELECT * FROM expenses WHERE userid = $1', [userId]),
            pool.query('SELECT * FROM budgets WHERE user_id = $1', [userId]),
            pool.query('SELECT * FROM incomes WHERE userid = $1', [userId]),
        ]);
        const prompt = generateFinancialOverviewPrompt({
            savings,
            expenses,
            budgets,
            income
        });
        const ai = new GoogleGenAI({
            apiKey: process.env.GOOGLE_API_KEY,
        });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return NextResponse.json({
            success: true,
            data: response,
        }, { status: 200 })
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: String(error)
        }, { status: 500 })
    }
}
