import { NextResponse } from "next/server";
import pool from "@/database/db";
import { determineStatus } from "@/lib/determine-status";
import { getSessionUserId, unauthorizedResponse } from "@/lib/auth/session";

export async function PATCH(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    const body = await request.json();

    if (!body.id || body.amount === undefined) {
      return NextResponse.json({
        success: false,
        message: "Missing required fields: id and amount"
      }, { status: 400 });
    }

    const getCurrentSaving = "SELECT * FROM savings WHERE id = $1 AND userid = $2";
    const currentResult = await pool.query(getCurrentSaving, [body.id, userId]);

    if (currentResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "Saving not found"
      }, { status: 404 });
    }

    const currentAmount = parseFloat(currentResult.rows[0].amount);
    const currentStatus = currentResult.rows[0].status;
    const withdrawAmount = parseFloat(body.amount);

    if (withdrawAmount > currentAmount) {
      return NextResponse.json({
        success: false,
        message: "Insufficient funds"
      }, { status: 400 });
    }

    const newAmount = currentAmount - withdrawAmount;
    const newStatus = determineStatus(
      newAmount,
      currentResult.rows[0].goal,
      currentResult.rows[0].target_date,
      currentResult.rows[0].created_at
    );

    if (newStatus !== currentStatus) {
      const updateStatusQuery = "UPDATE savings SET status = $1 WHERE id = $2 AND userid = $3";
      await pool.query(updateStatusQuery, [newStatus, body.id, userId]);
    }

    const query = "UPDATE savings SET amount = $1 WHERE id = $2 AND userid = $3 RETURNING *";
    const result = await pool.query(query, [newAmount, body.id, userId]);

    // Update the expenses table with the new transaction
    const newTransactionQuery = "INSERT INTO expenses (userid, name, date, amount, type, paymentmethod, category) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *";
    await pool.query(newTransactionQuery, [
      userId,
      `${currentResult.rows[0].name} - Withdrawal`,
      new Date(),
      withdrawAmount,
      "saving",
      "debit",
      "Saving"
    ]);

    // Add to savings_history
    const historyQuery = `
      INSERT INTO savings_history (saving_id, amount, type, date)
      VALUES ($1, $2, $3, NOW() )
      RETURNING *`

      try{
        await pool.query(historyQuery, [body.id, withdrawAmount, 'withdrawal']);
      } catch (error) {
        console.error('Error inserting into savings_history:', error);
        return NextResponse.json({
          success: false,
          message: "Error adding withdrawal to savings history",
          error: String(error)
        }, { status: 500 });
      }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    }, { status: 200 });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    return NextResponse.json({
      success: false,
      message: "Error processing withdrawal",
      error: String(error)
    }, { status: 500 });
  }
}
