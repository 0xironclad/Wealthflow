"use server";

import pool from "@/database/db";
import { getSessionUserId } from "@/lib/auth/session";

export const getIncomesById = async () => {
  const userId = await getSessionUserId();
  if (!userId) {
    console.error("[getIncomesById] No signed-in user");
    return [];
  }

  try {
    const query = "SELECT * FROM incomes WHERE userid = $1 ORDER BY date DESC";
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error("Error in getIncomesById:", error);
    return [];
  }
};

export async function createIncome(data: {
  name: string;
  amount: number;
  date: Date;
  category: string;
  source: string;
  isRecurring: boolean;
  recurringFrequency?: string;
}) {
  const userId = await getSessionUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const query = `
      INSERT INTO incomes (
        userId, name, amount, date, category, source, isRecurring, recurringFrequency
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [
      userId,
      data.name,
      data.amount,
      data.date,
      data.category,
      data.source,
      data.isRecurring,
      data.recurringFrequency || null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error("Error creating income:", error);
    throw error;
  }
}

export const getTotalIncome = async () => {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // Total balance = incomes - expenses + withdrawals
    const incomeQuery = `SELECT SUM(amount) AS total_income FROM incomes WHERE userid = $1`;
    const incomeResult = await pool.query(incomeQuery, [userId]);
    const totalIncome = parseFloat(incomeResult.rows[0].total_income || 0);

    const expenseQuery = `SELECT SUM(amount) AS total_expense FROM expenses WHERE userid = $1 AND (type = 'expense' OR type = 'saving')`;
    const expenseResult = await pool.query(expenseQuery, [userId]);
    const totalExpense = parseFloat(expenseResult.rows[0].total_expense || 0);

    const withdrawalQuery = `SELECT SUM(amount) AS total_withdrawal FROM expenses WHERE userid = $1 AND type = 'withdrawal'`;
    const withdrawalResult = await pool.query(withdrawalQuery, [userId]);
    const totalWithdrawal = parseFloat(
      withdrawalResult.rows[0].total_withdrawal || 0
    );

    const totalBalance =
      Number(totalIncome) - Number(totalExpense) + Number(totalWithdrawal);

    return Number(totalBalance.toFixed(2));
  } catch (error) {
    console.error("Error in getTotalIncome:", error);
    return 0;
  }
};

export const getMonthlyIncomeTotal = async (
  year?: number,
  month?: number
) => {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // If no year/month provided, use current month
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month ?? now.getMonth() + 1; // getMonth() returns 0-11, we need 1-12

    // Calculate start and end dates for the month
    const startOfMonth = new Date(targetYear, targetMonth - 1, 1)
      .toISOString()
      .split("T")[0];
    const endOfMonth = new Date(targetYear, targetMonth, 0)
      .toISOString()
      .split("T")[0];

    const query = `
            SELECT
                COALESCE(SUM(amount), 0) as total_income,
                COUNT(*) as income_count,
                COALESCE(AVG(amount), 0) as average_income
            FROM incomes
            WHERE userid = $1
            AND date >= $2::date
            AND date <= $3::date
        `;
    const result = await pool.query(query, [userId, startOfMonth, endOfMonth]);

    return {
      totalIncome: parseFloat(result.rows[0].total_income),
      incomeCount: parseInt(result.rows[0].income_count),
      averageIncome: parseFloat(result.rows[0].average_income),
      dateRange: { from: startOfMonth, to: endOfMonth },
    };
  } catch (error) {
    console.error("Error in getMonthlyIncomeTotal:", error);
    return {
      totalIncome: 0,
      incomeCount: 0,
      averageIncome: 0,
      dateRange: { from: null, to: null },
    };
  }
};

export const getCurrentMonthIncomeTotal = async () => {
  return getMonthlyIncomeTotal();
};

export async function deleteIncome(incomeId: string) {
  const userId = await getSessionUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    if (!incomeId) {
      throw new Error("Income ID is required");
    }

    const query = `DELETE FROM incomes WHERE id = $1 AND userid = $2 RETURNING *`;
    const result = await pool.query(query, [incomeId, userId]);

    if (result.rowCount === 0) {
      throw new Error("Income not found or unauthorized");
    }

    return result.rows[0];
  } catch (error) {
    console.error("Error deleting income:", error);
    throw error;
  }
}

export async function updateIncome(data: {
  id: string;
  name: string;
  amount: number;
  date: Date;
  category: string;
  source: string;
  isRecurring: boolean;
  recurringFrequency?: string;
}) {
  const userId = await getSessionUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    if (!data.id) {
      throw new Error("Income ID is required");
    }

    const query = `
      UPDATE incomes SET
        name = $1,
        amount = $2,
        date = $3,
        category = $4,
        source = $5,
        isRecurring = $6,
        recurringFrequency = $7
      WHERE id = $8 AND userid = $9
      RETURNING *
    `;
    const values = [
      data.name,
      data.amount,
      data.date,
      data.category,
      data.source,
      data.isRecurring,
      data.recurringFrequency || null,
      data.id,
      userId,
    ];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      throw new Error("Income not found or unauthorized");
    }

    return result.rows[0];
  } catch (error) {
    console.error("Error updating income:", error);
    throw error;
  }
}
