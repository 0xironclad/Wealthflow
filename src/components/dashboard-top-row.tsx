"use client";
import {
    Card,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown, CreditCard, PiggyBank, DollarSign, Wallet } from "lucide-react"
import { getIncomesById } from "@/server/income";
import { getExpensesById } from "@/server/expense";
import { useQuery } from "@tanstack/react-query";
import { InvoiceType, IncomeType, SavingsType } from "@/lib/types";
import { getSavings } from "@/server/saving";
import { getBudgetsById } from "@/server/budget";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/context/UserContext";
import { useMonthlyIncome } from "@/hooks/useMonthlyIncome";

interface FinancialMetricCardProps {
    label: string;
    value: number | string;
    percentageChange?: number;
    isPositive?: boolean;
    previousValue?: number;
    icon: React.ComponentType<{ className?: string }>;
    gradient: string;
    viewAllLink?: string;
}

const FinancialMetricCardSkeleton: React.FC<{ gradient: string }> = ({ gradient }) => {
    return (
        <Card className="h-full flex flex-col border-border/50">
            <div className="p-4 flex flex-col h-full justify-between">
                {/* Header skeleton */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 bg-gradient-to-r ${gradient} rounded-xl opacity-50`}>
                            <div className="w-4 h-4" />
                        </div>
                        <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-5 w-14 rounded-full" />
                </div>

                {/* Main value skeleton */}
                <div className="flex-1 flex items-center">
                    <Skeleton className="h-7 w-28" />
                </div>

                {/* Comparison skeleton */}
                <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                </div>
            </div>
        </Card>
    );
};

const BudgetProgressCardSkeleton: React.FC = () => {
    return (
        <Card className="h-full flex flex-col border-border/50">
            <div className="p-4 flex flex-col h-full">
                {/* Header skeleton */}
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl opacity-50">
                        <div className="w-4 h-4" />
                    </div>
                    <Skeleton className="h-3 w-24" />
                </div>

                {/* Progress circle and details skeleton */}
                <div className="flex-1 flex items-center justify-between">
                    <div className="relative">
                        <Skeleton className="w-14 h-14 rounded-full" />
                    </div>
                    <div className="text-right space-y-1.5">
                        <Skeleton className="h-3 w-20 ml-auto" />
                        <Skeleton className="h-5 w-16 ml-auto" />
                        <Skeleton className="h-3 w-14 ml-auto" />
                    </div>
                </div>
            </div>
        </Card>
    );
};

const FinancialMetricCard: React.FC<FinancialMetricCardProps> = ({
    label,
    value,
    percentageChange,
    isPositive = true,
    previousValue,
    icon: Icon,
    gradient,
    viewAllLink
}) => {
    const TrendIcon = isPositive ? TrendingUp : TrendingDown;

    return (
        <Card className="h-full flex flex-col relative overflow-hidden border-border/50 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
            {/* Decorative gradient background */}
            <div className={`absolute -top-16 -right-16 w-32 h-32 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-2xl`} />

            <div className="p-4 flex flex-col h-full justify-between relative z-10">
                {/* Header with icon */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 bg-gradient-to-br ${gradient} rounded-xl shadow-sm`}>
                            <Icon className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">{label}</span>
                    </div>
                    {percentageChange !== undefined ? (
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${isPositive ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                            <TrendIcon className={`w-3 h-3 ${isPositive ? 'text-primary' : 'text-destructive'}`} />
                            <span className={`text-xs font-semibold ${isPositive ? 'text-primary' : 'text-destructive'}`}>
                                {isPositive ? '+' : ''}{percentageChange}%
                            </span>
                        </div>
                    ) : viewAllLink ? (
                        <a href={viewAllLink} className="text-xs font-medium text-primary hover:underline">
                            View all
                        </a>
                    ) : null}
                </div>

                {/* Main value */}
                <div className="flex-1 flex items-center">
                    <div className="text-2xl font-bold text-foreground tracking-tight">
                        {typeof value === 'number' ? `$${value.toLocaleString()}` : value}
                    </div>
                </div>

                {/* Comparison */}
                {percentageChange !== undefined && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>vs last month</span>
                        {previousValue !== undefined && (
                            <span className="bg-secondary/80 px-2 py-0.5 rounded-full font-medium">
                                ${previousValue.toLocaleString()}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
};

type BudgetResponse = {
    success: boolean;
    message?: string;
    data?: Array<{
        id: number;
        user_id: number;
        name: string;
        description: string;
        period_type: string;
        start_date: string;
        end_date: string;
        category: string;
        planned_amount: number;
        spent_amount: number;
        is_rollover: boolean;
    }>;
};

type TransformedBudget = {
    id: number;
    userId: number;
    name: string;
    description: string;
    periodType: string;
    startDate: string;
    endDate: string;
    category: string;
    plannedAmount: number;
    spentAmount: number;
    rollOver: string;
};

const DashboardTopRow: React.FC = () => {
    const queryClient = useQueryClient();
    const today = new Date();
    const oneMonthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

    const { user, isLoading: isLoadingUser } = useUser();

    const { data: incomes, isLoading: isLoadingIncomes } = useQuery({
        queryKey: ['incomes', user?.id],
        refetchOnWindowFocus: false,
        queryFn: () => {
            if (!user) return Promise.resolve([]);
            return getIncomesById();
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 5,
    });

    const { data: expenses } = useQuery({
        queryKey: ['expenses', user?.id],
        queryFn: () => user ? getExpensesById(user.id) : null,
        enabled: !!user,
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 60,
        initialData: queryClient.getQueryData(['expenses']),
        select: (data) => data?.map((expense: InvoiceType) => ({
            id: expense.id,
            userId: expense.userId,
            name: expense.name,
            date: expense.date,
            amount: Number(expense.amount),
            type: expense.type,
            paymentMethod: expense.paymentMethod,
            category: expense.category
        }))
    });

    const { data: savings } = useQuery({
        queryKey: ['savings', user?.id],
        queryFn: () => user ? getSavings(user.id) : null,
        enabled: !!user,
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 60,
        initialData: queryClient.getQueryData(['savings']),
        select: (data) => data?.map((saving: {
            id: number;
            userid: number;
            name: string;
            date: string;
            amount: string | number;
            goal: string | number;
            status: string;
            description: string;
        }) => ({
            id: saving.id,
            userId: saving.userid,
            name: saving.name,
            date: saving.date,
            amount: Number(saving.amount),
            goal: Number(saving.goal),
            status: saving.status,
            description: saving.description
        }))
    });

    const { data: categories, isLoading } = useQuery<BudgetResponse, Error, TransformedBudget[]>({
        queryKey: ['budgets', user?.id],
        staleTime: 1000 * 60 * 5,
        queryFn: () => user ? getBudgetsById(user.id) : Promise.resolve({ success: true, data: [] }),
        enabled: !!user,
        refetchOnWindowFocus: false,
        select: (data) => {
            if (!data.success || !data.data) return [];
            return data.data.map((budget) => ({
                id: budget.id,
                userId: budget.user_id,
                name: budget.name,
                description: budget.description,
                periodType: budget.period_type,
                startDate: budget.start_date,
                endDate: budget.end_date,
                category: budget.category,
                plannedAmount: Number(budget.planned_amount),
                spentAmount: Number(budget.spent_amount),
                rollOver: budget.is_rollover ? "Yes" : "No"
            }));
        }
    });

    const { data: monthlyIncomeData } = useMonthlyIncome(user?.id ?? '', today.getFullYear(), today.getMonth() + 1);
    const totalIncomeThisMonth = monthlyIncomeData?.totalIncome ?? 0;

    const isLoadingData = isLoadingUser || isLoadingIncomes;

    if (isLoadingData) {
        return (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-4 h-full">
                <FinancialMetricCardSkeleton gradient="from-emerald-500 to-teal-600" />
                <FinancialMetricCardSkeleton gradient="from-rose-500 to-pink-600" />
                <FinancialMetricCardSkeleton gradient="from-blue-500 to-cyan-600" />
                <div className="col-span-3 md:col-span-1">
                    <BudgetProgressCardSkeleton />
                </div>
            </div>
        );
    }

    if (!user) return null;

    const netSavings = savings?.reduce((sum: number, saving: SavingsType) => sum + saving.amount, 0) ?? 0;

    // Current month calculations
    const expensesThisMonth = expenses?.filter((expense: InvoiceType) => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === today.getMonth() &&
            expenseDate.getFullYear() === today.getFullYear() && expense.type === 'expense';
    }).reduce((sum: number, expense: InvoiceType) => sum + Number(expense.amount), 0) ?? 0;


    // Previous month calculations for comparison
    const expensesLastMonth = expenses?.filter((expense: InvoiceType) => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === oneMonthAgo.getMonth() &&
            expenseDate.getFullYear() === oneMonthAgo.getFullYear() && expense.type === 'expense';
    }).reduce((sum: number, expense: InvoiceType) => sum + Number(expense.amount), 0) ?? 0;

    const totalIncomeLastMonth = incomes
        ?.filter((income: IncomeType) => {
            const incomeDate = new Date(income.date);
            return incomeDate.getMonth() === oneMonthAgo.getMonth() &&
                incomeDate.getFullYear() === oneMonthAgo.getFullYear();
        })
        .reduce((sum: number, income: IncomeType) => {
            const amount = typeof income.amount === 'string'
                ? parseFloat(income.amount)
                : Number(income.amount);
            return sum + (isNaN(amount) ? 0 : amount);
        }, 0) ?? 0;

    // Calculate percentage changes
    const incomeChange = totalIncomeLastMonth > 0
        ? Math.round(((totalIncomeThisMonth - totalIncomeLastMonth) / totalIncomeLastMonth) * 100)
        : 0;

    const expenseChange = expensesLastMonth > 0
        ? Math.round(((expensesThisMonth - expensesLastMonth) / expensesLastMonth) * 100)
        : 0;

    // budgets
    const totalBudget = categories?.reduce((sum: number, budget: { plannedAmount: number; }) => sum + budget.plannedAmount, 0) ?? 0;
    const totalSpent = categories?.reduce((sum: number, budget: { spentAmount: number; }) => sum + budget.spentAmount, 0) ?? 0;
    const percentUsed = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;


    return (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-4 h-full">
            <FinancialMetricCard
                label="Income This Month"
                value={totalIncomeThisMonth}
                percentageChange={incomeChange}
                isPositive={incomeChange >= 0}
                previousValue={totalIncomeLastMonth}
                icon={DollarSign}
                gradient="from-emerald-500 to-teal-600"
            />
            <FinancialMetricCard
                label="Expenses This Month"
                value={Number(expensesThisMonth)}
                percentageChange={Math.abs(expenseChange)}
                isPositive={expenseChange <= 0} // Lower expenses are positive
                previousValue={expensesLastMonth}
                icon={CreditCard}
                gradient="from-rose-500 to-pink-600"
            />
            <FinancialMetricCard
                label="Net Savings"
                value={Number(netSavings)}
                icon={PiggyBank}
                gradient="from-blue-500 to-cyan-600"
                viewAllLink="/goals"
            />
            <div className="col-span-3 md:col-span-1">
                <Card className="h-full flex flex-col relative overflow-hidden border-border/50 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                    {/* Decorative gradient background */}
                    <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 opacity-10 blur-2xl" />

                    <div className="p-4 flex flex-col h-full relative z-10">
                        {/* Header */}
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-sm">
                                <Wallet className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">Budget Progress</span>
                        </div>

                        {/* Progress circle and details */}
                        <div className="flex-1 flex items-center justify-between">
                            <div className="relative">
                                <div className="w-14 h-14 rounded-full border-4 border-secondary flex items-center justify-center">
                                    <span className="text-sm font-bold text-foreground">
                                        {isLoading ? '...' : `${percentUsed}%`}
                                    </span>
                                </div>
                                <svg className="absolute top-0 left-0 w-14 h-14 transform -rotate-90" viewBox="0 0 56 56">
                                    <circle
                                        cx="28"
                                        cy="28"
                                        r="24"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        fill="none"
                                        className={`transition-all duration-500 ${percentUsed > 90 ? 'text-destructive' :
                                            percentUsed > 70 ? 'text-chart-4' : 'text-primary'
                                            }`}
                                        strokeDasharray={`${(percentUsed / 100) * 150.8} 150.8`}
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-muted-foreground mb-0.5">Spent / Budget</div>
                                <div className="text-lg font-bold text-foreground leading-tight">
                                    ${totalSpent.toLocaleString()}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    of ${totalBudget.toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default DashboardTopRow;
