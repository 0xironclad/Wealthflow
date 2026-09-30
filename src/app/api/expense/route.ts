import { NextResponse } from "next/server";
import pool from "@/database/db";
import {
  ExpenseSchema,
  UpdateExpenseSchema,
} from "@/lib/schemas/expense-schema";
import { getSessionUserId, unauthorizedResponse } from "@/lib/auth/session";

const validateId = (id: string | null, name: string) => {
  if (!id) {
    return {
      isValid: false,
      error: {
        success: false,
        message: `${name} must be a positive number`,
      },
    };
  }
  return { isValid: true };
};

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    const query = "SELECT * FROM expenses WHERE userid = $1";

    const result = await pool.query(query, [userId]);

    return NextResponse.json(
      {
        success: true,
        data: result.rows,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Error fetching expenses",
        error,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { error } = ExpenseSchema.safeParse(body);
    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid expense data",
          error,
        },
        { status: 400 }
      );
    }

    // Start a transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Insert the expense
      const expenseQuery =
        "INSERT INTO expenses (userid, name, date, amount, type, paymentmethod, category) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *";
      const expenseResult = await client.query(expenseQuery, [
        userId,
        body.name,
        body.date,
        body.amount,
        body.type,
        body.paymentMethod,
        body.category,
      ]);

      // If it's an expense, update the corresponding budget
      if (body.type === "expense") {
        // Find the active budget for this category and user that covers the transaction date
        const budgetQuery = `
                    SELECT id, spent_amount
                    FROM budgets
                    WHERE user_id = $1
                    AND category = $2
                    AND is_active = true
                    AND start_date <= $3::date
                    AND end_date >= $3::date
                    ORDER BY created_at DESC
                    LIMIT 1
                `;
        const budgetResult = await client.query(budgetQuery, [
          userId,
          body.category,
          body.date,
        ]);

        // If a budget exists, update its spent amount
        if (budgetResult.rows.length > 0) {
          const budget = budgetResult.rows[0];
          const updateBudgetQuery = `
                        UPDATE budgets
                        SET spent_amount = spent_amount + $1,
                            updated_at = NOW()
                        WHERE id = $2
                        RETURNING *
                    `;
          await client.query(updateBudgetQuery, [body.amount, budget.id]);
        }
      }

      // Handle income insertion if needed
      if (body.type === "income") {
        try {
          const incomeQuery = `
                        INSERT INTO incomes (
                            userid,
                            name,
                            date,
                            amount,
                            category,
                            source,
                            isrecurring,
                            recurringfrequency
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        RETURNING *
                    `;
          await client.query(incomeQuery, [
            userId,
            body.name,
            body.date,
            body.amount,
            body.category,
            body.paymentMethod,
            body.isRecurring || false,
            body.recurringFrequency || null,
          ]);
        } catch (incomeError) {
          console.error("Error inserting income:", incomeError);
        }
      }

      // Commit the transaction
      await client.query("COMMIT");

      return NextResponse.json(
        {
          success: true,
          data: expenseResult.rows[0],
        },
        { status: 201 }
      );
    } catch (error) {
      // Rollback the transaction in case of error
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error in POST /api/expense:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error adding transaction",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorizedResponse();
  }

  const client = await pool.connect();
  try {
    const body = await request.json();
    const { error } = UpdateExpenseSchema.safeParse(body);
    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid expense data",
          error,
        },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    // Get the old expense to adjust budgets, scoped to the owner
    const oldExpenseQuery =
      "SELECT * FROM expenses WHERE id = $1 AND userid = $2";
    const oldExpenseResult = await client.query(oldExpenseQuery, [
      body.id,
      userId,
    ]);
    const oldExpense = oldExpenseResult.rows[0];

    if (!oldExpense) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          success: false,
          message: "Expense not found",
        },
        { status: 404 }
      );
    }

    // Update the expense, scoped to the owner
    const query =
      "UPDATE expenses SET name = $1, date = $2, amount = $3, type = $4, paymentmethod = $5, category = $6 WHERE id = $7 AND userid = $8 RETURNING *";
    const result = await client.query(query, [
      body.name,
      body.date,
      body.amount,
      body.type,
      body.paymentMethod,
      body.category,
      body.id,
      userId,
    ]);

    // If old expense was an expense type, subtract from old budget
    if (oldExpense.type === "expense") {
      const oldBudgetQuery = `
                SELECT id FROM budgets
                WHERE user_id = $1
                AND category = $2
                AND is_active = true
                AND start_date <= $3::date
                AND end_date >= $3::date
                ORDER BY created_at DESC
                LIMIT 1
            `;
      const oldBudgetResult = await client.query(oldBudgetQuery, [
        oldExpense.userid,
        oldExpense.category,
        oldExpense.date,
      ]);
      if (oldBudgetResult.rows.length > 0) {
        await client.query(
          "UPDATE budgets SET spent_amount = spent_amount - $1, updated_at = NOW() WHERE id = $2",
          [oldExpense.amount, oldBudgetResult.rows[0].id]
        );
      }
    }

    // If new expense is an expense type, add to new budget
    if (body.type === "expense") {
      const newBudgetQuery = `
                SELECT id FROM budgets
                WHERE user_id = $1
                AND category = $2
                AND is_active = true
                AND start_date <= $3::date
                AND end_date >= $3::date
                ORDER BY created_at DESC
                LIMIT 1
            `;
      const newBudgetResult = await client.query(newBudgetQuery, [
        userId,
        body.category,
        body.date,
      ]);
      if (newBudgetResult.rows.length > 0) {
        await client.query(
          "UPDATE budgets SET spent_amount = spent_amount + $1, updated_at = NOW() WHERE id = $2",
          [body.amount, newBudgetResult.rows[0].id]
        );
      }
    }

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        data: result.rows[0],
      },
      { status: 200 }
    );
  } catch (error) {
    await client.query("ROLLBACK");
    return NextResponse.json(
      {
        success: false,
        message: "Error updating expense",
        error,
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// Delete an expense from the database
export async function DELETE(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorizedResponse();
  }

  const client = await pool.connect();
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    const expenseValidation = validateId(id, "Expense ID");
    if (!expenseValidation.isValid) {
      return NextResponse.json(expenseValidation.error, { status: 400 });
    }

    await client.query("BEGIN");

    const queryCheck = "SELECT * FROM expenses WHERE id = $1 AND userid = $2";
    const resultCheck = await client.query(queryCheck, [id, userId]);
    if (resultCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          success: false,
          message: "Expense not found",
        },
        { status: 404 }
      );
    }

    const expense = resultCheck.rows[0];

    // If it's an expense, subtract from budget
    if (expense.type === "expense") {
      const budgetQuery = `
                SELECT id FROM budgets
                WHERE user_id = $1
                AND category = $2
                AND is_active = true
                AND start_date <= $3::date
                AND end_date >= $3::date
                ORDER BY created_at DESC
                LIMIT 1
            `;
      const budgetResult = await client.query(budgetQuery, [
        userId,
        expense.category,
        expense.date,
      ]);
      if (budgetResult.rows.length > 0) {
        await client.query(
          "UPDATE budgets SET spent_amount = spent_amount - $1, updated_at = NOW() WHERE id = $2",
          [expense.amount, budgetResult.rows[0].id]
        );
      }
    }

    const query =
      "DELETE FROM expenses WHERE id = $1 AND userid = $2 RETURNING *";
    const result = await client.query(query, [id, userId]);

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        message: "Expense deleted successfully",
        data: result.rows[0],
      },
      { status: 200 }
    );
  } catch (error) {
    await client.query("ROLLBACK");
    return NextResponse.json(
      {
        success: false,
        message: "Error deleting expense",
        error,
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
