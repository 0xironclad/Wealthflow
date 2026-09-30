import type { Pool } from "pg";
import { determineStatus } from "@/lib/determine-status";

// Recalculates and persists the status of a user's non-completed savings.
// Runs on read (see GET /api/savings) instead of a background job.
export async function refreshSavingStatuses(db: Pool, userId: string) {
    const { rows } = await db.query(
        `SELECT id, amount, goal, status, target_date, created_at
         FROM savings
         WHERE userid = $1 AND status != 'completed'`,
        [userId]
    );

    for (const saving of rows) {
        const newStatus = determineStatus(
            saving.amount,
            saving.goal,
            saving.target_date,
            saving.created_at
        );

        if (newStatus !== saving.status) {
            await db.query(
                "UPDATE savings SET status = $1 WHERE id = $2 AND userid = $3",
                [newStatus, saving.id, userId]
            );
        }
    }
}
