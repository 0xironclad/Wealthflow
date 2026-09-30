"use client";
import { useQuery } from "@tanstack/react-query";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RadialProgress } from "./radial-progress";
import { getSavings } from "@/server/saving"
import { Target, CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";
import { SavingsType } from "@/lib/types";
import { useUser } from "@/context/UserContext";
import { cn } from "@/lib/utils";

function FinancialGoalSummary() {
    const { user, isLoading: isAuthLoading } = useUser();

    const { data: savings, isLoading } = useQuery({
        queryKey: ['savings', user?.id],
        queryFn: () => user ? getSavings(user.id) : null,
        enabled: !!user,
        // Matches the other observers of this key (dashboard, savings accounts grid).
        staleTime: 1000 * 60 * 60,
        refetchOnWindowFocus: false,
        select: (data) => data.map((saving: {
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
            status: saving.status
        }))

    })

    if (isLoading || isAuthLoading) {
        return (
            <Card className="w-full h-full flex flex-col border-border/50">
                <CardHeader className="py-3">
                    <Skeleton className="h-4 w-40" />
                </CardHeader>
                <CardContent className="flex justify-between items-center flex-1 py-2">
                    <div className="space-y-2">
                        {[...Array(4)].map((_, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <Skeleton className="h-7 w-7 rounded-lg" />
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-16" />
                                    <Skeleton className="h-4 w-6" />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="h-28 w-28 flex-shrink-0 flex items-center justify-center">
                        <div className="relative">
                            <Skeleton className="h-24 w-24 rounded-full" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Skeleton className="h-6 w-10" />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const activeGoals = savings?.filter((saving: SavingsType) => saving.status === 'active').length || 0;
    const completed = savings?.filter((saving: SavingsType) => saving.status === 'completed').length || 0;
    const atRisk = savings?.filter((saving: SavingsType) => saving.status === 'atRisk').length || 0;
    const onTrack = activeGoals - atRisk;
    const totalGoals = activeGoals + completed + atRisk;
    const percentageComplete = totalGoals > 0 ? Math.round((completed / totalGoals) * 100) : 0;

    const goalSummary = [
        { label: 'Active', value: activeGoals, icon: Target, color: 'text-chart-2' },
        { label: 'Completed', value: completed, icon: CheckCircle2, color: 'text-primary' },
        { label: 'At Risk', value: atRisk, icon: AlertTriangle, color: 'text-chart-4' },
        { label: 'On Track', value: onTrack, icon: TrendingUp, color: 'text-chart-1' }
    ];

    return (
        <Card className="w-full h-full flex flex-col relative overflow-hidden border-border/50">
            {/* Decorative gradient */}
            <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-primary/10 blur-3xl" />

            <CardHeader className="py-3 relative z-10">
                <CardTitle className="text-sm font-semibold">Financial Goal Summary</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-between items-center flex-1 py-2 relative z-10">
                <div className="space-y-2">
                    {goalSummary.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <div key={index} className="flex items-center gap-2">
                                <div className={cn("p-1.5 rounded-lg bg-secondary/80")}>
                                    <Icon className={cn("w-3.5 h-3.5", item.color)} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">{item.label}</span>
                                    <span className="text-sm font-semibold text-foreground">{item.value}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="h-28 w-28 flex-shrink-0 flex items-center justify-center">
                    <RadialProgress progress={percentageComplete} />
                </div>
            </CardContent>
        </Card>
    );
}

export default FinancialGoalSummary;
