import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import pool from "@/database/db";
import { getSessionUserId, unauthorizedResponse } from "@/lib/auth/session";

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    const {rows: savings} = await pool.query('SELECT * FROM savings WHERE userid = $1', [userId]);
    if (!savings || savings.length === 0) {
      return NextResponse.json(
        { success: false, message: "No savings found for the user" },
        { status: 404 }
      );
    }
    const savingsInsightPrompt = `
You are a financial AI assistant that helps users manage and optimize their savings goals.
Users set specific savings goals (e.g., Buy a House, Emergency Fund), define a target amount, and contribute toward it regularly.

Based on the user's savings goals, target amounts, contributions, timeframes, and progress, generate personalized insights to help the user:

- Stay motivated and consistent in saving
- Reach their goals faster with strategic adjustments
- Identify opportunities to increase savings
- Adjust unrealistic goals or timelines
- Celebrate milestones to keep morale high

Respond with an array of 4 actionable insights in the following JSON format:

\`\`\`json
{
  "title": "Brief headline of the insight (e.g., 'You're Almost There!')",
  "description": "Explanation of the insight or recommendation based on their goal progress and behavior",
  "goalName": "The name of the goal this insight is related to",
  "progress": "Progress percentage (e.g., '75% complete')",
  "suggestionType": "motivation | action | adjustment | celebration"
}
\`\`\`

Be empathetic, supportive, and data-driven. Avoid generic advice and tailor your suggestions to the user’s actual savings behavior and goal timelines.

Here is the user's savings data:

  ${JSON.stringify(savings)}

Only generate insights relevant to the user's current savings state.
If the user is behind on a goal, recommend realistic adjustments.
If they are on track, keep them encouraged.
If they completed a goal, celebrate it!
`;

    const ai = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY,
    });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: savingsInsightPrompt,
    });
    return NextResponse.json(
      {
        success: true,
        data: response,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Error fetching savings",
        error: String(error),
      },
      { status: 500 }
    );
  }
}
