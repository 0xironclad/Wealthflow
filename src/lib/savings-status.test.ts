import { describe, it, expect, vi } from "vitest";
import { refreshSavingStatuses } from "./savings-status";
import type { Pool } from "pg";

describe("refreshSavingStatuses", () => {
  it("issues a single batched UPDATE for every row that changed, not one per row", async () => {
    const query = vi.fn();
    // First call: the SELECT. Two savings need a status change, one doesn't.
    query.mockResolvedValueOnce({
      rows: [
        { id: 1, amount: 1000, goal: 1000, status: "active", target_date: null, created_at: "2024-01-01" }, // -> completed
        { id: 2, amount: 100, goal: 1000, status: "active", target_date: null, created_at: "2024-01-01" }, // stays active
        { id: 3, amount: 50, goal: 1000, status: "atRisk", target_date: "2023-01-01", created_at: "2022-01-01" }, // stays atRisk
      ],
    });
    // Second call: the batched UPDATE.
    query.mockResolvedValueOnce({ rows: [] });

    const db = { query } as unknown as Pool;

    await refreshSavingStatuses(db, "user-1");

    // Exactly 2 queries total: the SELECT and one batched UPDATE, regardless
    // of how many rows changed.
    expect(query).toHaveBeenCalledTimes(2);
    const [updateSql, updateParams] = query.mock.calls[1];
    expect(updateSql).toMatch(/UPDATE savings/i);
    expect(updateParams).toEqual([[1], ["completed"], "user-1"]);
  });

  it("issues no UPDATE when nothing changed", async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [
        { id: 2, amount: 100, goal: 1000, status: "active", target_date: null, created_at: "2024-01-01" },
      ],
    });
    const db = { query } as unknown as Pool;

    await refreshSavingStatuses(db, "user-1");

    expect(query).toHaveBeenCalledTimes(1);
  });
});
