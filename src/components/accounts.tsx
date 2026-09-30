"use client";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUpRight,
  Wallet,
  Plus,
  TrendingUp,
  TrendingDown,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getIncomesById, getTotalIncome } from "@/server/income";
import { useUser } from '@/context/UserContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { IncomeForm } from "./income/income-form"
import { IncomeManagement } from "./income/income-management"
import { useMutation } from "@tanstack/react-query"
import { createIncome } from "@/server/income"
import { useToast } from "@/hooks/use-toast"
import { z } from "zod"
import { formSchema } from "./income/income-form"
import { format } from "date-fns"

type IncomeRecord = {
  id: string;
  name: string;
  amount: number;
  date: string;
  category: string;
  source: string;
  isrecurring: boolean;
  recurringfrequency?: string;
};

type ProcessedIncomeData = {
  allIncomes: IncomeRecord[];
  recentIncomes: IncomeRecord[];
  thisMonthTotal: number;
  lastMonthTotal: number;
  recurringCount: number;
  totalCount: number;
};

export default function AccountsCard() {
  const { user, isLoading: isAuthLoading } = useUser();
  const { toast } = useToast()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data: incomeData, error } = useQuery({
    queryKey: ['incomes', user?.id],
    queryFn: () => getIncomesById(),
    enabled: !!user?.id,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 60,
    select: (response): ProcessedIncomeData => {
      if (!response || response.length === 0) {
        return {
          allIncomes: [],
          recentIncomes: [],
          thisMonthTotal: 0,
          lastMonthTotal: 0,
          recurringCount: 0,
          totalCount: 0
        };
      }

      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
      const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

      let thisMonthTotal = 0;
      let lastMonthTotal = 0;
      let recurringCount = 0;

      response.forEach((income: IncomeRecord) => {
        const incomeDate = new Date(income.date);
        const incomeMonth = incomeDate.getMonth();
        const incomeYear = incomeDate.getFullYear();

        if (incomeMonth === thisMonth && incomeYear === thisYear) {
          thisMonthTotal += Number(income.amount);
        }
        if (incomeMonth === lastMonth && incomeYear === lastMonthYear) {
          lastMonthTotal += Number(income.amount);
        }
        if (income.isrecurring) {
          recurringCount++;
        }
      });

      const recentIncomes = response.slice(0, 4);

      return {
        allIncomes: response,
        recentIncomes,
        thisMonthTotal,
        lastMonthTotal,
        recurringCount,
        totalCount: response.length
      };
    }
  });

  const { data: totalBalance, isLoading: totalIncomeLoading } = useQuery({
    queryKey: ['totalBalance', user?.id],
    queryFn: () => getTotalIncome(),
    refetchOnWindowFocus: false,
    enabled: !!user?.id,
    select: (response) => {
      const amount = Number(response);
      return amount;
    },
    retry: 1
  });


  const queryClient = useQueryClient()

  const createIncomeMutation = useMutation({
    mutationFn: createIncome,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['monthly-income', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['totalBalance', user?.id] })
      toast({
        title: "Success",
        description: "Income added successfully",
      })
      setIsAddDialogOpen(false);
    },
    onError: (error) => {
      console.error('Income creation error:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add income. Please try again.",
        variant: "destructive",
      })
    },
  })

  const handleAddIncome = async (data: z.infer<typeof formSchema>) => {
    createIncomeMutation.mutate(data)
  }

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const getMonthlyChange = () => {
    if (!incomeData) return { percent: 0, isPositive: true };
    const { thisMonthTotal, lastMonthTotal } = incomeData;
    if (lastMonthTotal === 0) return { percent: thisMonthTotal > 0 ? 100 : 0, isPositive: true };
    const change = ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
    return { percent: Math.abs(change), isPositive: change >= 0 };
  };

  if (isAuthLoading || totalIncomeLoading) {
    return (
      <Card className="h-full w-full relative flex flex-col overflow-hidden border-border/50">
        <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-primary/5 blur-3xl" />
        <CardHeader className="p-4 pb-3 border-b border-border/50 relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-7 w-28" />
            </div>
            <Skeleton className="h-6 w-14 rounded-md" />
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-md" />
              <div>
                <Skeleton className="h-2 w-14 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-md" />
              <div>
                <Skeleton className="h-2 w-14 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-3 relative z-10">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
          <div className="space-y-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-xl">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-xl" />
                  <div>
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <div className="text-right">
                  <Skeleton className="h-4 w-16 mb-1" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="p-3 border-t border-border/50 relative z-10 gap-2">
          <Skeleton className="flex-1 h-9 rounded-md" />
          <Skeleton className="flex-1 h-9 rounded-md" />
        </CardFooter>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full w-full relative overflow-hidden border-border/50">
        <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-destructive/5 blur-3xl" />
        <CardHeader className="p-4 border-b border-border/50 relative z-10">
          <p className="text-xs text-muted-foreground">Total Balance</p>
          <CardTitle className="text-2xl font-bold">$0</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px] relative z-10">
          <p className="text-sm text-muted-foreground">Error loading income data</p>
        </CardContent>
      </Card>
    );
  }

  if (!incomeData || incomeData.recentIncomes.length === 0) {
    return (
      <Card className="h-full w-full relative flex flex-col overflow-hidden border-border/50">
        <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-primary/5 blur-3xl" />
        <CardHeader className="p-4 border-b border-border/50 relative z-10">
          <p className="text-xs text-muted-foreground">Total Balance</p>
          <CardTitle className="text-2xl font-bold">
            {totalBalance !== undefined ? formatCurrency(totalBalance) : '$0'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center relative z-10">
          <div className="flex flex-col items-center justify-center space-y-5 px-4 text-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Wallet className="w-10 h-10 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-chart-2/20 flex items-center justify-center">
                <ArrowUpRight className="w-3.5 h-3.5 text-chart-2" />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                No income sources yet
              </h3>
              <p className="text-xs text-muted-foreground">
                Start tracking your earnings
              </p>
            </div>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Your First Income
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Income</DialogTitle>
                  <DialogDescription>
                    Add a new income source to your account
                  </DialogDescription>
                </DialogHeader>
                <IncomeForm onSubmit={handleAddIncome} />
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    );
  }
  const monthlyChange = getMonthlyChange();

  return (
    <Card className="h-full w-full relative flex flex-col overflow-hidden border-border/50">
      <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-primary/5 blur-3xl" />

      <CardHeader className="p-4 pb-3 border-b border-border/50 relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total Balance</p>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {totalBalance !== undefined ? formatCurrency(totalBalance) : '$0'}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/50">
            {monthlyChange.isPositive ? (
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-destructive" />
            )}
            <span className={cn(
              "text-xs font-medium",
              monthlyChange.isPositive ? "text-primary" : "text-destructive"
            )}>
              {monthlyChange.percent.toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <Calendar className="w-3 h-3 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">This Month</p>
              <p className="text-xs font-semibold">{formatCurrency(incomeData.thisMonthTotal)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-chart-2/10">
              <RefreshCw className="w-3 h-3 text-chart-2" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Recurring</p>
              <p className="text-xs font-semibold">{incomeData.recurringCount} sources</p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto styled-scrollbar p-3 relative z-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium text-muted-foreground">Recent Income</h2>
          <span className="text-[10px] text-muted-foreground">{incomeData.totalCount} total</span>
        </div>

        <div className="space-y-1">
          {incomeData.recentIncomes.map((income) => (
            <div
              key={income.id}
              className={cn(
                "group flex items-center justify-between",
                "p-2.5 rounded-xl",
                "hover:bg-secondary/60",
                "transition-all duration-200",
                "border border-transparent hover:border-border/50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
                  <Wallet className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-foreground truncate">{income.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">{income.category}</span>
                    {income.isrecurring && (
                      <>
                        <span className="text-muted-foreground/50">·</span>
                        <RefreshCw className="w-2.5 h-2.5 text-muted-foreground" />
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(Number(income.amount))}
                </span>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(income.date), 'MMM d')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter className="p-3 border-t border-border/50 relative z-10 gap-2">
        <IncomeManagement
          incomes={incomeData.allIncomes}
          userId={user?.id as string}
        />
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="flex-1 h-9 gap-2">
              <Plus className="w-4 h-4" />
              <span>Add Income</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Income</DialogTitle>
              <DialogDescription>
                Add a new income source to your account
              </DialogDescription>
            </DialogHeader>
            <IncomeForm onSubmit={handleAddIncome} />
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
}
