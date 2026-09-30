"use client"

import { TrendingUp, TrendingDown } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { useQuery } from "@tanstack/react-query"
import { getIncomesById } from "@/server/income"
import { getExpensesById } from "@/server/expense"
import { useUser } from "@/context/UserContext"
import { IncomeType } from "@/lib/types"
import { InvoiceType } from "@/lib/types"

import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"

const chartConfig = {
    desktop: {
        label: "Savings",
        color: "hsl(var(--primary))",
    },
} satisfies ChartConfig

export function MonthlySavingsLineChart() {
    const { user } = useUser();

    const { data: incomes } = useQuery({
        queryKey: ['incomes', user?.id],
        queryFn: () => user ? getIncomesById() : null,
        enabled: !!user
    });

    const { data: expenses } = useQuery({
        queryKey: ['expenses', user?.id],
        queryFn: () => user ? getExpensesById(user.id) : null,
        enabled: !!user
    });
    const calculateMonthlySavings = () => {
        if (!incomes || !expenses) return [];

        const today = new Date();
        const months = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            return {
                month: d.toLocaleString('default', { month: 'long' }),
                year: d.getFullYear(),
                monthIndex: d.getMonth()
            };
        }).reverse();

        const monthlySavings = months.map(({ month, year, monthIndex }) => {
            const monthlyIncome = incomes.filter((income: IncomeType) => {
                const date = new Date(income.date);
                return date.getMonth() === monthIndex && date.getFullYear() === year && income;
            }).reduce((sum: number, income: IncomeType) => sum + Number(income.amount), 0);

            const monthlyExpense = expenses.filter((expense: InvoiceType) => {
                const date = new Date(expense.date);
                return date.getMonth() === monthIndex && date.getFullYear() === year && expense.type === 'expense';
            }).reduce((sum: number, expense: InvoiceType) => sum + Number(expense.amount), 0);

            return {
                month,
                savings: monthlyIncome - monthlyExpense
            };
        });

        return monthlySavings;
    };

    const savingsData = calculateMonthlySavings();

    const calculateTrendPercentage = () => {
        if (savingsData.length < 2) return 0;

        const currentMonth = savingsData[savingsData.length - 1].savings;
        const previousMonth = savingsData[savingsData.length - 2].savings;

        if (currentMonth === 0 && previousMonth === 0) return 0;
        if (previousMonth === 0) {
            return currentMonth > 0 ? 100 : -100;
        }
        const percentageChange = ((currentMonth - previousMonth) / Math.abs(previousMonth)) * 100;

        return percentageChange;
    };

    const trendPercentage = calculateTrendPercentage();

    return (
        <Card className="h-[200px] w-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                    Monthly Savings Trend
                </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
                <ChartContainer config={chartConfig} className="h-[100px] w-full">
                    <AreaChart
                        accessibilityLayer
                        data={savingsData}
                        margin={{
                            left: 12,
                            right: 12,
                            top: 5,
                            bottom: 5
                        }}
                        width={undefined}
                        height={100}
                    >
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={4}
                            tickFormatter={(value) => value.slice(0, 3)}
                            fontSize={10}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={
                                <ChartTooltipContent
                                    indicator="dot"
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    formatter={(value : any) => typeof value === 'number' ? `$${value.toLocaleString()}` : value}
                                />
                            }
                        />
                        <Area
                            dataKey="savings"
                            type="linear"
                            fill="hsl(var(--primary))"
                            fillOpacity={0.2}
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
            <CardFooter className="pt-0 pb-2">
                <div className="flex w-full items-start gap-1 text-xs">
                    <div className="grid gap-1">
                        <div className="flex items-center gap-1 font-medium leading-none">
                            <span className="text-muted-foreground text-xs">
                                {savingsData.length >= 2 ? (
                                    `Saving trend: ${trendPercentage.toFixed(1)}% from last month`
                                ) : (
                                    'Not enough data for trend calculation'
                                )}
                            </span>
                            {trendPercentage > 0 ? (
                                <TrendingUp className="h-4 w-4 text-green-500" />
                            ) : (
                                <TrendingDown className="h-4 w-4 text-red-500" />
                            )}
                        </div>
                    </div>
                </div>
            </CardFooter>
        </Card>
    );
}
