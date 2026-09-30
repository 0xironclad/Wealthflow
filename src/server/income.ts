"use server";

import pool from "@/database/db";
import { getSessionUserId } from "@/lib/auth/session";

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
