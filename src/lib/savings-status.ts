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

    const changedIds: number[] = [];
    const changedStatuses: string[] = [];

    for (const saving of rows) {
        const newStatus = determineStatus(
            saving.amount,
            saving.goal,
            saving.target_date,
            saving.created_at
        );

        if (newStatus !== saving.status) {
            changedIds.push(saving.id);
            changedStatuses.push(newStatus);
        }
    }

    if (changedIds.length === 0) {
        return;
    }

    // One UPDATE for every row that changed instead of one per row.
    await db.query(
        `UPDATE savings AS s
         SET status = c.status
         FROM unnest($1::int[], $2::text[]) AS c(id, status)
         WHERE s.id = c.id AND s.userid = $3`,
        [changedIds, changedStatuses, userId]
    );
}
