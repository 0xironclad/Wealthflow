"use client";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import {
    Loader2,
    TrendingUp,
    Wallet,
    Target,
    AlertCircle
} from "lucide-react";
import { InsightsSummaryCards } from "@/components/insights-summary-page";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getSavings } from "@/server/saving";
import { getBudgetsById } from "@/server/budget";
import { getFinancialHealth } from "@/server/analytics";
import { useState, useEffect } from "react";
import { Saving } from "@/lib/types";
import { useUser } from "@/context/UserContext";
import { getOverviewRecommendation } from "@/server/ai";
import { RecommendationType } from "@/lib/types";



const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;
const STORAGE_KEY = 'insights_recommendations_cache';

interface CachedRecommendations {
    recommendations: RecommendationType[];
    timestamp: number;
}

type BudgetPerformance = {
    name: string;
    budget: number;
    spent: number;
    percentage: number;
};


const shouldFetchNewRecommendations = (cached: CachedRecommendations | null): boolean => {
    if (!cached) return true;
    return Date.now() - cached.timestamp > CACHE_DURATION;
};

export default function InsightsPage() {
    const { user, isLoading: isLoadingUser } = useUser();
    const [recommendations, setRecommendations] = useState<RecommendationType[]>([]);
    const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);

    const getCachedRecommendations = (): CachedRecommendations | null => {
        try {
            const cached = localStorage.getItem(STORAGE_KEY);
            if (!cached) return null;
            return JSON.parse(cached);
        } catch (error) {
            console.error('Error reading from cache:', error);
            return null;
        }
    };

    const setCachedRecommendations = (data: RecommendationType[]) => {
        try {
            const cacheData: CachedRecommendations = {
                recommendations: data,
                timestamp: Date.now(),
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData));
        } catch (error) {
            console.error('Error writing to cache:', error);
        }
    };

    useEffect(() => {
        const fetchRecommendations = async () => {
            if (!user?.id) return;

            const cached = getCachedRecommendations();
            if (cached && !shouldFetchNewRecommendations(cached)) {
                setRecommendations(cached.recommendations);
                return;
            }

            setIsLoadingRecommendations(true);
            try {
                const data = await getOverviewRecommendation(user.id);
                if (Array.isArray(data)) {
                    setRecommendations(data);
                    setCachedRecommendations(data);
                } else {
                    console.error('Recommendations data is not an array:', data);
                    setRecommendations([]);
                }
            } catch (error) {
                console.error('Error fetching recommendations:', error);
                setRecommendations([]);
            } finally {
                setIsLoadingRecommendations(false);
            }
        };

        fetchRecommendations();
    }, [user]);

    const handleRefreshRecommendations = () => {
        localStorage.removeItem(STORAGE_KEY);
        if (user?.id) {
            getOverviewRecommendation(user.id)
                .then((data) => {
                    if (Array.isArray(data)) {
                        setRecommendations(data);
                        setCachedRecommendations(data);
                    }
                })
                .catch((error) => {
                    console.error('Error refreshing recommendations:', error);
                });
        }
    };

    const { data: savings, isLoading: isLoadingSavings } = useQuery({
        queryKey: ['savings', user?.id],
        queryFn: () => getSavings(user?.id ?? ''),
        enabled: !!user?.id && !isLoadingUser,
        select: (data) => data.map((saving: {
            id: number;
            userid: number;
            name: string;
            created_at: string;
            target_date: string;
            amount: string;
            goal: string;
            status: string;
            description: string;
        }) => ({
            id: saving.id,
            userId: saving.userid,
            name: saving.name,
            createdAt: saving.created_at,
            targetDate: saving.target_date,
            amount: parseFloat(saving.amount),
            goal: parseFloat(saving.goal),
            status: saving.status,
            description: saving.description
        }))
    });

    const { data: budgets } = useQuery({
        queryKey: ['budgets', user?.id],
        queryFn: () => user ? getBudgetsById(user.id) : Promise.resolve({ success: true, data: [] }),
        enabled: !!user,
        select: (data) => {
            if (!data.success || !data.data) return [];
            return data.data.map((budget: {
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
            }) => ({
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



    const { data: financialHealth } = useQuery<{ score: number; savingsRate: number; runwayMonths: number; grade: string }>({
        queryKey: ['financialHealth', user?.id],
        queryFn: () => user ? getFinancialHealth() : Promise.resolve({ score: 0, savingsRate: 0, runwayMonths: 0, grade: 'N/A' }),
        enabled: !!user,
    });

    // *SAVINGS COMPUTATIONS
    const calculateTotalSavingProgress = (savings: Saving[] | undefined) => {
        if (!savings || savings.length === 0) return 0;
        const amount = savings.reduce((total, saving) => total + (saving.amount || 0), 0);
        const goal = savings.reduce((total, saving) => total + (saving.goal || 0), 0);
        return goal === 0 ? 0 : (amount / goal) * 100;
    }
    const progress: number = isLoadingSavings || isLoadingUser ? 0 : parseFloat(calculateTotalSavingProgress(savings).toFixed(1));

    const calculateSavingsSchedule = (savings: Saving[] | undefined): number => {
        if (!savings || savings.length === 0) return 0;

        let totalMonthsAheadBehind = 0;

        savings.forEach(saving => {
            const today = new Date();
            const startDate = new Date(saving.createdAt);
            const targetDate = new Date(saving.targetDate);

            const totalTimeframe = targetDate.getTime() - startDate.getTime();
            const timeElapsed = today.getTime() - startDate.getTime();
            const expectedProgress = (timeElapsed / totalTimeframe) * saving.goal;
            const actualProgress = saving.amount;
            const progressDifference = actualProgress - expectedProgress;

            const monthlyRate = saving.goal / (totalTimeframe / (1000 * 60 * 60 * 24 * 30.44));
            const monthsAheadBehind = progressDifference / monthlyRate;

            totalMonthsAheadBehind += monthsAheadBehind;
        });
        return Number((totalMonthsAheadBehind / savings.length).toFixed(1));
    };

    const getSavingsScheduleStatus = (monthsAheadBehind: number) => {
        if (monthsAheadBehind > 0) {
            return {
                status: 'Ahead',
                months: Math.abs(monthsAheadBehind),
                text: `${Math.abs(monthsAheadBehind)} ${Math.abs(monthsAheadBehind) === 1 ? 'month' : 'months'} ahead of schedule`
            };
        } else if (monthsAheadBehind < 0) {
            return {
                status: 'Behind',
                months: Math.abs(monthsAheadBehind),
                text: `${Math.abs(monthsAheadBehind)} ${Math.abs(monthsAheadBehind) === 1 ? 'month' : 'months'} behind schedule`
            };
        } else {
            return {
                status: 'On track',
                months: 0,
                text: 'On track'
            };
        }
    };

    const monthsAheadBehind = calculateSavingsSchedule(savings);
    const savingsScheduleStatus = getSavingsScheduleStatus(monthsAheadBehind);
    const progressStatus = {
        status: savingsScheduleStatus.status,
        months: savingsScheduleStatus.months,
        text: savingsScheduleStatus.text,
        progress: progress
    };

    // * BUDGET COMPUTATIONS
    const budgetPerformance = budgets?.map((budget: {
        name: string;
        plannedAmount: number;
        spentAmount: number;
    }) => ({
        name: budget.name,
        budget: budget.plannedAmount,
        spent: budget.spentAmount,
        percentage: (budget.spentAmount / budget.plannedAmount) * 100
    }));

    const calculateBudgetProgress = (budgets: BudgetPerformance[] | undefined) => {
        if (!budgets || budgets.length === 0) return 0;
        const totalBudget = budgets.reduce((total: number, budget: BudgetPerformance) => total + budget.budget, 0);
        const totalSpent = budgets.reduce((total: number, budget: BudgetPerformance) => total + budget.spent, 0);
        return totalBudget === 0 ? 0 : (totalSpent / totalBudget) * 100;
    }

    const budgetProgress: number = isLoadingSavings || isLoadingUser ? 0 : parseFloat(calculateBudgetProgress(budgetPerformance).toFixed(1));

    const budgetsOverSpentCount = budgetPerformance?.filter((category: BudgetPerformance) => category.spent > category.budget).length ?? 0;
    const overspentBudgets: string[] = budgetPerformance?.filter((category: BudgetPerformance) => category.spent > category.budget).map((category: BudgetPerformance) => category.name) ?? [];

    const budgetHealthPropData = {
        budgetProgress: Math.round(budgetProgress),
        budgetsOverSpentCount: budgetsOverSpentCount,
        overspentBudgets: overspentBudgets
    }


    return (
        <div className="w-full h-full flex flex-col overflow-hidden">
            <div className="flex-shrink-0 px-4 py-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <h1 className="text-3xl font-bold">Insights</h1>
            </div>

            <div className="flex-1 flex flex-col gap-4 px-4 pb-4 overflow-y-auto styled-scrollbar">
                {/* Top Row - Summary Cards */}
                <div className="flex-shrink-0">
                    <InsightsSummaryCards progressStatus={progressStatus} budgetHealthPropData={budgetHealthPropData} />
                </div>

                {/* Middle Section - Charts and Recommendations */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[400px]">
                    {/* Left Column - AI Recommendations */}
                    <Card className="md:col-span-1 flex flex-col min-h-0 relative overflow-hidden border-border/50">
                        {/* Decorative gradient */}
                        <div className="absolute -top-16 -left-16 w-32 h-32 rounded-full bg-purple-500/10 blur-3xl" />
                        <div className="absolute -bottom-16 -right-16 w-32 h-32 rounded-full bg-primary/10 blur-3xl" />

                        <CardHeader className="flex-none relative z-10">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-sm font-semibold">AI Recommendations</CardTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleRefreshRecommendations}
                                    disabled={isLoadingRecommendations}
                                    className="h-8 px-2"
                                >
                                    {isLoadingRecommendations ? (
                                        <Loader2 className="animate-spin h-4 w-4" />
                                    ) : (
                                        "Refresh"
                                    )}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto min-h-0 relative z-10">
                            <div className="space-y-3 styled-scrollbar max-h-full overflow-y-auto pr-2">
                                {isLoadingRecommendations ? (
                                    <div className="space-y-3">
                                        {[...Array(4)].map((_, index) => (
                                            <div
                                                key={index}
                                                className="space-y-2 p-3 rounded-xl"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <Skeleton className="h-4 flex-1" />
                                                    <Skeleton className="h-5 w-14 rounded-full" />
                                                </div>
                                                <Skeleton className="h-3 w-full" />
                                                <Skeleton className="h-3 w-4/5" />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    recommendations.map((recommendation, index) => (
                                        <div
                                            key={index}
                                            className="space-y-2 p-3 bg-secondary/30 rounded-xl hover:bg-secondary/50 transition-colors duration-200"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm font-medium flex-1 text-foreground">{recommendation.title}</p>
                                                <span className={cn(
                                                    "text-xs px-2 py-0.5 rounded-full font-medium",
                                                    {
                                                        "bg-destructive/20 text-destructive": recommendation.priority === "high",
                                                        "bg-chart-4/20 text-chart-4": recommendation.priority === "medium",
                                                        "bg-primary/20 text-primary": recommendation.priority === "low"
                                                    }
                                                )}>
                                                    {recommendation.priority}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground leading-relaxed">{recommendation.description}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Right Column - Financial Health & Breakdown */}
                    <div className="md:col-span-2 flex flex-col min-h-0">
                        <Card className="flex-1 flex flex-col min-h-0 overflow-hidden relative border-border/50">
                            {/* Decorative gradient */}
                            <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-chart-1/10 blur-3xl" />
                            <div className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full bg-chart-2/10 blur-3xl" />

                            <CardHeader className="relative z-10">
                                <CardTitle className="text-sm font-semibold">Financial Health</CardTitle>
                                <CardDescription className="text-xs">Overview of your financial stability and goals</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-y-auto styled-scrollbar relative z-10">
                                <div className="flex flex-col space-y-6">
                                    {/* Health Score & Metrics */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Score Card */}
                                        <div className="bg-gradient-to-br from-secondary/30 to-secondary/10 rounded-xl p-5 flex flex-col items-center justify-center text-center space-y-3 border border-border/50">
                                            <div className="relative">
                                                <div className="w-28 h-28 rounded-full border-6 border-secondary flex items-center justify-center bg-card">
                                                    <span className="text-3xl font-bold text-foreground">{financialHealth?.score ?? 0}</span>
                                                </div>
                                                <div className={cn(
                                                    "absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold",
                                                    {
                                                        "bg-primary text-primary-foreground": (financialHealth?.score ?? 0) >= 80,
                                                        "bg-chart-2 text-white": (financialHealth?.score ?? 0) >= 60 && (financialHealth?.score ?? 0) < 80,
                                                        "bg-chart-4 text-white": (financialHealth?.score ?? 0) >= 40 && (financialHealth?.score ?? 0) < 60,
                                                        "bg-destructive text-white": (financialHealth?.score ?? 0) < 40,
                                                    }
                                                )}>
                                                    {financialHealth?.grade ?? 'N/A'}
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-semibold text-foreground">Health Score</h3>
                                                <p className="text-xs text-muted-foreground">Savings, budget & runway</p>
                                            </div>
                                        </div>

                                        {/* Metrics Grid */}
                                        <div className="grid grid-cols-1 gap-3">
                                            <div className="bg-secondary/20 rounded-xl p-3 flex items-center gap-3 border border-border/50 hover:border-primary/20 transition-colors">
                                                <div className="p-2.5 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl">
                                                    <TrendingUp className="w-5 h-5 text-primary" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs text-muted-foreground">Savings Rate</p>
                                                    <p className="text-lg font-bold text-foreground">{financialHealth?.savingsRate ?? 0}%</p>
                                                </div>
                                                <span className="text-xs text-muted-foreground bg-secondary/80 px-2 py-0.5 rounded-full">Target: 20%</span>
                                            </div>
                                            <div className="bg-secondary/20 rounded-xl p-3 flex items-center gap-3 border border-border/50 hover:border-primary/20 transition-colors">
                                                <div className="p-2.5 bg-gradient-to-br from-chart-2/20 to-chart-2/5 rounded-xl">
                                                    <Wallet className="w-5 h-5 text-chart-2" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs text-muted-foreground">Runway</p>
                                                    <p className="text-lg font-bold text-foreground">{financialHealth?.runwayMonths ?? 0} Months</p>
                                                </div>
                                                <span className="text-xs text-muted-foreground bg-secondary/80 px-2 py-0.5 rounded-full">Avg expenses</span>
                                            </div>
                                            <div className="bg-secondary/20 rounded-xl p-3 flex items-center gap-3 border border-border/50 hover:border-primary/20 transition-colors">
                                                <div className="p-2.5 bg-gradient-to-br from-chart-1/20 to-chart-1/5 rounded-xl">
                                                    <Target className="w-5 h-5 text-chart-1" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs text-muted-foreground">Budget Status</p>
                                                    <p className="text-lg font-bold text-foreground">{budgetsOverSpentCount === 0 ? "On Track" : `${budgetsOverSpentCount} Over`}</p>
                                                </div>
                                                <span className="text-xs text-muted-foreground bg-secondary/80 px-2 py-0.5 rounded-full">Active</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Health Breakdown Section */}
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-semibold text-foreground">Health Breakdown</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* At-Risk Budgets */}
                                            <div className="space-y-2">
                                                <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                                    <AlertCircle className="w-3.5 h-3.5" /> At-Risk Budgets
                                                </h4>
                                                {budgetPerformance && budgetPerformance.some((b: BudgetPerformance) => b.percentage >= 80) ? (
                                                    <div className="space-y-2">
                                                        {budgetPerformance.filter((b: BudgetPerformance) => b.percentage >= 80).slice(0, 3).map((budget: BudgetPerformance, i: number) => (
                                                            <div key={i} className="flex justify-between items-center p-2.5 bg-secondary/20 rounded-xl border border-border/50">
                                                                <span className="text-sm font-medium text-foreground">{budget.name}</span>
                                                                <span className={cn("text-sm font-bold", budget.percentage > 100 ? "text-destructive" : "text-chart-4")}>
                                                                    {Math.round(budget.percentage)}%
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="p-4 bg-secondary/20 rounded-xl border border-border/50 text-center">
                                                        <div className="flex flex-col items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            </div>
                                                            <p className="text-sm font-medium text-foreground">All budgets healthy!</p>
                                                            <p className="text-xs text-muted-foreground">No budgets at risk</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Top Savings Goals */}
                                            <div className="space-y-2">
                                                <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                                    <Target className="w-3.5 h-3.5" /> Top Savings Goals
                                                </h4>
                                                {savings && savings.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {[...savings].sort((a: Saving, b: Saving) => b.amount - a.amount).slice(0, 3).map((saving: Saving, i: number) => (
                                                            <div key={i} className="flex justify-between items-center p-2.5 bg-secondary/20 rounded-xl border border-border/50">
                                                                <span className="text-sm font-medium text-foreground">{saving.name}</span>
                                                                <div className="text-right">
                                                                    <span className="text-sm font-bold text-foreground block">${saving.amount.toLocaleString()}</span>
                                                                    <span className="text-xs text-muted-foreground">of ${saving.goal.toLocaleString()}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="p-4 bg-secondary/20 rounded-xl border border-border/50 text-center text-sm text-muted-foreground">
                                                        No active savings goals.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
