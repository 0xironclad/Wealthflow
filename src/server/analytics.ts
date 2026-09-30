// Reads go through GET routes so they run in parallel; Next.js runs server actions one at a time.

type CategoryTrends = {
    data: { month: string; [category: string]: number | string }[];
    categories: string[];
};

type FinancialHealth = {
    score: number;
    savingsRate: number;
    runwayMonths: number;
    grade: string;
};

const EMPTY_FINANCIAL_HEALTH: FinancialHealth = {
    score: 0,
    savingsRate: 0,
    runwayMonths: 0,
    grade: "N/A",
};

const EMPTY_CATEGORY_TRENDS: CategoryTrends = { data: [], categories: [] };

const fetchAnalytics = async <T>(path: string, fallback: T): Promise<T> => {
    try {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Error fetching ${path}: ${response.statusText}`);
        }
        const result = await response.json();
        return result.data ?? fallback;
    } catch (error) {
        console.error(`Error fetching ${path}:`, error);
        return fallback;
    }
};

export const getMonthlyCashFlow = async (): Promise<
    { name: string; income: number; expense: number }[]
> => fetchAnalytics("/api/analytics/cash-flow", []);

export const getSpendingByCategory = async (): Promise<
    { name: string; value: number; fill: string }[]
> => fetchAnalytics("/api/analytics/spending-by-category", []);

export const getFinancialHealth = async (): Promise<FinancialHealth> =>
    fetchAnalytics("/api/analytics/financial-health", EMPTY_FINANCIAL_HEALTH);

export const getCategoryTrends = async (): Promise<CategoryTrends> =>
    fetchAnalytics("/api/analytics/category-trends", EMPTY_CATEGORY_TRENDS);
