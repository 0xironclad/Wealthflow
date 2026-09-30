import { useQuery } from "@tanstack/react-query";
import { getExpensesById } from "@/server/expense";
import { getIncomesById } from "@/server/income-queries";
import { getSavings, getSavingsHistory } from "@/server/saving";

export const useExpenses = (userId: string) => {
    return useQuery({
        queryKey: ["expenses", userId],
        queryFn: () => getExpensesById(userId),
        enabled: !!userId,
        select: (data) =>
            data.map(
                (expense: {
                    id: number;
                    userid: string;
                    name: string;
                    date: string;
                    amount: string;
                    type: "income" | "expense";
                    paymentmethod: string;
                    category: string;
                }) => ({
                    id: expense.id,
                    userId: expense.userid,
                    name: expense.name,
                    date: expense.date,
                    amount: parseFloat(expense.amount),
                    type: expense.type,
                    paymentMethod: expense.paymentmethod,
                    category: expense.category,
                })
            ),
        // Same staleTime as the other 'expenses' observers, so they don't refetch each other.
        staleTime: 1000 * 60 * 60,
        refetchOnWindowFocus: false,
    });
};

export const useIncomes = (userId: string) => {
    return useQuery({
        queryKey: ["incomes", userId],
        queryFn: () => getIncomesById(),
        enabled: !!userId,
        select: (data) =>
            data.map(
                (income: {
                    id: number;
                    userid: string;
                    name: string;
                    date: string;
                    amount: string;
                    category: string;
                    source: string;
                }) => ({
                    id: income.id,
                    userId: income.userid,
                    name: income.name,
                    date: income.date,
                    amount: parseFloat(income.amount),
                    type: "income",
                    category: income.category,
                    source: income.source,
                })
            ),
        staleTime: 1000 * 30,
    });
};

export const useSavings = (userId: string) => {
    return useQuery({
        queryKey: ["savings", userId],
        queryFn: async () => {
            console.log('[useSavings] Fetching savings for userId:', userId);
            try {
                const result = await getSavings(userId);
                console.log('[useSavings] Fetch successful, count:', result?.length);
                return result;
            } catch (error) {
                console.error('[useSavings] Fetch error:', error);
                throw error;
            }
        },
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 60,
        gcTime: 1000 * 60 * 60 * 2,
        retry: false,
        enabled: !!userId,
        select: (data) =>
            data?.map(
                (saving: {
                    id: number;
                    userid: number;
                    name: string;
                    date: string;
                    amount: string;
                    goal: string;
                    status: string;
                }) => ({
                    id: saving.id,
                    userId: saving.userid,
                    name: saving.name,
                    date: saving.date,
                    amount: parseFloat(saving.amount),
                    goal: parseFloat(saving.goal),
                    status: saving.status,
                })
            ) || [],
    });
};

export const useSavingsHistory = (userId: string) => {
    return useQuery({
        queryKey: ["savingsHistory", userId],
        queryFn: () => getSavingsHistory(userId),
        enabled: !!userId,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
    });
};


// Budget API functions
const fetchBudgets = async (userId: string, from?: string, to?: string) => {
    const params = new URLSearchParams({ userId });
    if (from) params.append('from', from);
    if (to) params.append('to', to);

    const response = await fetch(`/api/budget?${params.toString()}`);
    if (!response.ok) {
        throw new Error('Failed to fetch budgets');
    }
    const result = await response.json();
    return result.data;
};

const fetchBudgetTotal = async (userId: string, from?: string, to?: string) => {
    const params = new URLSearchParams({
        userId,
        total: 'true'
    });

    if (from) params.append('from', from);
    if (to) params.append('to', to);

    const response = await fetch(`/api/budget?${params.toString()}`);
    if (!response.ok) {
        throw new Error('Failed to fetch budget total');
    }
    const result = await response.json();
    return result.data;
};

// React Query hooks
export const useBudgets = (userId: string, from?: string, to?: string) => {
    return useQuery({
        queryKey: ["budgets", userId, from, to],
        queryFn: () => fetchBudgets(userId, from, to),
        enabled: !!userId,
        select: (data) =>
            data?.map((budget: {
                id: number;
                user_id: string;
                name: string;
                description: string;
                period_type: string;
                start_date: string;
                end_date: string;
                category: string;
                planned_amount: string;
                spent_amount: string;
                is_rollover: boolean;
            }) => ({
                id: budget.id,
                userId: budget.user_id,
                name: budget.name,
                description: budget.description,
                periodType: budget.period_type,
                startDate: budget.start_date,
                endDate: budget.end_date,
                category: budget.category,
                plannedAmount: parseFloat(budget.planned_amount),
                spentAmount: parseFloat(budget.spent_amount),
                isRollover: budget.is_rollover,
            })) || [],
        staleTime: 1000 * 30,
    });
};

export const useBudgetTotal = (userId: string, from?: string, to?: string) => {
    return useQuery({
        queryKey: ["budgetTotal", userId, from, to],
        queryFn: () => fetchBudgetTotal(userId, from, to),
        enabled: !!userId,
        staleTime: 1000 * 60, // 1 minute
    });
};
