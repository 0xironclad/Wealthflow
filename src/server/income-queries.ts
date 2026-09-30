// Read-only income helpers, fetched from the client so the browser can run
// them in parallel with the other dashboard requests. Server actions (see
// src/server/income.ts) are invoked one at a time by Next.js, which was
// serializing these reads on every page load.

export const getIncomesById = async () => {
  try {
    const response = await fetch(`/api/income`);
    if (!response.ok) {
      throw new Error(`Error fetching incomes: ${response.statusText}`);
    }
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error(error);
    return [];
  }
};

// Total balance = incomes - expenses + withdrawals (same formula /api/balance uses).
export const getTotalIncome = async (): Promise<number> => {
  try {
    const response = await fetch(`/api/balance`);
    if (!response.ok) {
      throw new Error(`Error fetching balance: ${response.statusText}`);
    }
    const result = await response.json();
    return Number(result.data) || 0;
  } catch (error) {
    console.error("Error in getTotalIncome:", error);
    return 0;
  }
};

export type MonthlyIncomeTotal = {
  totalIncome: number;
  incomeCount: number;
  averageIncome: number;
  dateRange: { from: string | null; to: string | null };
};

const EMPTY_MONTHLY_INCOME_TOTAL: MonthlyIncomeTotal = {
  totalIncome: 0,
  incomeCount: 0,
  averageIncome: 0,
  dateRange: { from: null, to: null },
};

export const getMonthlyIncomeTotal = async (
  year?: number,
  month?: number
): Promise<MonthlyIncomeTotal> => {
  try {
    // If no year/month provided, /api/income defaults to the current month.
    const params = new URLSearchParams({ total: "true" });
    if (year !== undefined && month !== undefined) {
      const startOfMonth = new Date(year, month - 1, 1).toISOString().split("T")[0];
      const endOfMonth = new Date(year, month, 0).toISOString().split("T")[0];
      params.set("from", startOfMonth);
      params.set("to", endOfMonth);
    }

    const response = await fetch(`/api/income?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Error fetching monthly income total: ${response.statusText}`);
    }
    const result = await response.json();
    return result.data ?? EMPTY_MONTHLY_INCOME_TOTAL;
  } catch (error) {
    console.error("Error in getMonthlyIncomeTotal:", error);
    return EMPTY_MONTHLY_INCOME_TOTAL;
  }
};

export const getCurrentMonthIncomeTotal = async (): Promise<MonthlyIncomeTotal> => {
  return getMonthlyIncomeTotal();
};
