import { NextResponse } from "next/server";
import pool from "@/database/db";
import { SavingSchema, UpdateSavingSchema } from "@/lib/schemas/saving-schema";
import { getSessionUserId, unauthorizedResponse } from "@/lib/auth/session";
import { refreshSavingStatuses } from "@/lib/savings-status";

// Fetch all the savings from the database
export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    await refreshSavingStatuses(pool, userId);

    const query = "SELECT * FROM savings WHERE userid = $1";

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
        message: "Error fetching savings",
        error,
      },
      { status: 500 }
    );
  }
}

// add a new saving to the database
export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorizedResponse();
  }

  const client = await pool.connect();

  try {
    const body = await request.json();
    const { error } = SavingSchema.safeParse(body);

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid saving data",
          error: error.errors,
        },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    const savingQuery = `
            INSERT INTO savings (
                userid,
                name,
                amount,
                goal,
                status,
                description,
                created_at,
                target_date
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;

    const savingValues = [
      userId,
      body.name,
      body.amount,
      body.goal,
      body.status,
      body.description,
      body.createdAt,
      body.targetDate,
    ];

    const savingResult = await client.query(savingQuery, savingValues);
    const newSaving = savingResult.rows[0];

    const historyQuery = `
            INSERT INTO savings_history (
                saving_id,
                amount,
                date,
                type
            )
            VALUES ($1, $2, $3, $4)
        `;

    const historyValues = [
      newSaving.id,
      body.amount,
      body.createdAt || new Date(),
      "deposit",
    ];

    await client.query(historyQuery, historyValues);

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        data: newSaving,
      },
      { status: 201 }
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating saving:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error creating saving",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// update
export async function PUT(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { error } = UpdateSavingSchema.safeParse(body);
    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid saving data",
          error,
        },
        { status: 400 }
      );
    }

    const query = `
            UPDATE savings
            SET name = $1,
                amount = $2,
                goal = $3,
                status = $4,
                description = $5,
                target_date = $6,
                updated_at = NOW()
            WHERE id = $7 AND userid = $8
            RETURNING *
        `;
    const result = await pool.query(query, [
      body.name,
      body.amount,
      body.goal,
      body.status,
      body.description,
      body.targetDate ?? null,
      body.id,
      userId,
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Saving not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.rows[0],
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Error updating saving",
        error,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    if (!body.id || !body.status) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields: id and status",
        },
        { status: 400 }
      );
    }
    if (isNaN(Number(body.id)) || Number(body.id) <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid saving ID",
        },
        { status: 400 }
      );
    }
    const { error } = UpdateSavingSchema.pick({ status: true }).safeParse(body);
    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid saving data",
          error,
        },
        { status: 400 }
      );
    }
    const checkQuery = "SELECT id FROM savings WHERE id = $1 AND userid = $2";
    const checkResult = await pool.query(checkQuery, [body.id, userId]);
    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Saving not found",
        },
        { status: 404 }
      );
    }
    const query =
      "UPDATE savings SET status = $1, updated_at = NOW() WHERE id = $2 AND userid = $3 RETURNING *";
    const result = await pool.query(query, [body.status, body.id, userId]);
    return NextResponse.json(
      {
        success: true,
        data: result.rows[0],
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Error updating saving",
        error,
      },
      { status: 500 }
    );
  }
}

// delete a saving and add back its amount to total balance as a withdrawal
export async function DELETE(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const id = body?.id;
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required field: id",
        },
        { status: 400 }
      );
    }

    const getQuery = "SELECT * FROM savings WHERE id = $1 AND userid = $2";
    const getResult = await pool.query(getQuery, [id, userId]);
    if (getResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Saving not found",
        },
        { status: 404 }
      );
    }

    const saving = getResult.rows[0];
    const currentAmount = parseFloat(saving.amount || 0);

    // if there is remaining amount, record a saving expense and history
    if (currentAmount > 0) {
      const expenseInsert = `
                INSERT INTO expenses (userid, name, date, amount, type, paymentmethod, category)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `;
      await pool.query(expenseInsert, [
        userId,
        `${saving.name} - Withdrawal (on delete)`,
        new Date(),
        currentAmount,
        "saving",
        "debit",
        "Saving",
      ]);

      const historyInsert = `
                INSERT INTO savings_history (saving_id, amount, type, date)
                VALUES ($1, $2, $3, NOW())
            `;
      await pool.query(historyInsert, [id, currentAmount, "withdrawal"]);
    }

    const deleteQuery = "DELETE FROM savings WHERE id = $1 AND userid = $2";
    await pool.query(deleteQuery, [id, userId]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Error deleting saving",
        error,
      },
      { status: 500 }
    );
  }
}
