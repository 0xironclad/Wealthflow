"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteIncome, createIncome, updateIncome } from "@/server/income";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Wallet,
  Settings,
  Trash2,
  RefreshCw,
  Calendar,
  Briefcase,
  DollarSign,
  AlertCircle,
  Loader2,
  Plus,
  TrendingUp,
  Pencil,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IncomeForm, formSchema } from "./income-form";
import { z } from "zod";

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

type IncomeManagementProps = {
  incomes: IncomeRecord[];
  userId: string;
};

const CATEGORIES = ["All", "Salary", "Bonus", "Investment", "Freelance", "Business", "Other"] as const;

export function IncomeManagement({ incomes, userId }: IncomeManagementProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIncome, setSelectedIncome] = useState<IncomeRecord | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Calculate statistics and chart data
  const { stats, chartData } = useMemo(() => {
    const totalIncome = incomes.reduce((sum, inc) => sum + Number(inc.amount), 0);
    const recurringCount = incomes.filter((inc) => inc.isrecurring).length;
    const avgIncome = incomes.length > 0 ? totalIncome / incomes.length : 0;

    // Group by month for chart (last 6 months)
    const monthlyData = new Map<string, number>();
    const now = new Date();

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = format(d, "MMM yyyy");
      monthlyData.set(key, 0);
    }

    incomes.forEach((inc) => {
      const incomeDate = new Date(inc.date);
      const key = format(incomeDate, "MMM yyyy");
      if (monthlyData.has(key)) {
        monthlyData.set(key, (monthlyData.get(key) || 0) + Number(inc.amount));
      }
    });

    const chartData = Array.from(monthlyData.entries()).map(([month, amount]) => ({
      month,
      amount,
    }));

    return {
      stats: { totalIncome, recurringCount, avgIncome, count: incomes.length },
      chartData,
    };
  }, [incomes]);

  // Filter incomes based on search and category
  const filteredIncomes = useMemo(() => {
    return incomes.filter((income) => {
      const matchesSearch = searchQuery === "" ||
        income.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        income.source.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === "All" || income.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [incomes, searchQuery, categoryFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("All");
  };

  const hasActiveFilters = searchQuery !== "" || categoryFilter !== "All";

  const chartConfig = {
    amount: {
      label: "Income",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig;

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["incomes", userId] });
    queryClient.invalidateQueries({ queryKey: ["totalBalance", userId] });
    queryClient.invalidateQueries({ queryKey: ["monthly-income", userId] });
  };

  const deleteMutation = useMutation({
    mutationFn: (incomeId: string) => deleteIncome(incomeId),
    onSuccess: () => {
      invalidateQueries();
      toast({ title: "Income deleted", description: "The income entry has been removed." });
      setShowDeleteDialog(false);
      setSelectedIncome(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete income",
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: createIncome,
    onSuccess: () => {
      invalidateQueries();
      toast({ title: "Income added", description: "New income entry has been created." });
      setShowAddDialog(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add income",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateIncome,
    onSuccess: () => {
      invalidateQueries();
      toast({ title: "Income updated", description: "The income entry has been updated." });
      setShowEditDialog(false);
      setSelectedIncome(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update income",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "salary":
        return <Briefcase className="w-4 h-4" />;
      case "investment":
        return <TrendingUp className="w-4 h-4" />;
      default:
        return <Wallet className="w-4 h-4" />;
    }
  };

  const handleEdit = (income: IncomeRecord) => {
    setSelectedIncome(income);
    setShowEditDialog(true);
  };

  const handleDelete = (income: IncomeRecord) => {
    setSelectedIncome(income);
    setShowDeleteDialog(true);
  };

  const handleAddIncome = (data: z.infer<typeof formSchema>) => {
    createMutation.mutate(data);
  };

  const handleUpdateIncome = (data: z.infer<typeof formSchema>) => {
    if (selectedIncome) {
      updateMutation.mutate({ id: selectedIncome.id, ...data });
    }
  };

  return (
    <>
      {/* Main Management Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="flex-1 h-9 gap-2">
            <Settings className="w-4 h-4" />
            <span>Manage</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col p-0 gap-0">
          {/* Header */}
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-xl">Income Management</DialogTitle>
                <DialogDescription className="mt-1">
                  Track, manage and analyze your income sources
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Stats + Chart Section */}
          <div className="p-6 pb-4">
            <div className="grid grid-cols-12 gap-6">
              {/* Stats Cards */}
              <div className="col-span-4 space-y-3">
                <div className="p-4 rounded-xl border border-border/50 bg-secondary/20">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wide font-medium">Total Income</span>
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalIncome)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl border border-border/50 bg-secondary/20">
                    <p className="text-xs text-muted-foreground mb-1">Entries</p>
                    <p className="text-xl font-bold">{stats.count}</p>
                  </div>
                  <div className="p-4 rounded-xl border border-border/50 bg-secondary/20">
                    <p className="text-xs text-muted-foreground mb-1">Recurring</p>
                    <p className="text-xl font-bold">{stats.recurringCount}</p>
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-border/50 bg-secondary/20">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wide font-medium">Average</span>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(stats.avgIncome)}</p>
                </div>
              </div>

              {/* Chart */}
              <div className="col-span-8 p-4 rounded-xl border border-border/50 bg-secondary/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium">Income Trend (Last 6 Months)</h3>
                </div>
                {chartData.some((d) => d.amount > 0) ? (
                  <ChartContainer config={chartConfig} className="h-[160px] w-full">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => value.split(" ")[0]}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value) => formatCurrency(Number(value))}
                          />
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#incomeGradient)"
                      />
                    </AreaChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[160px] flex items-center justify-center text-muted-foreground text-sm">
                    No income data to display
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Income List */}
          <div className="flex-1 min-h-0 p-6 pt-4">
            {/* Search, Filter and Add Button Row */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or source..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2 text-muted-foreground">
                  Clear
                </Button>
              )}
              <Button className="gap-2 h-9" onClick={() => setShowAddDialog(true)}>
                <Plus className="w-4 h-4" />
                Add Income
              </Button>
            </div>

            {/* Results count */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                {hasActiveFilters ? "Filtered Results" : "All Income Entries"}
              </h3>
              <span className="text-xs text-muted-foreground">
                {filteredIncomes.length} of {incomes.length} entries
              </span>
            </div>

            <div className="max-h-[240px] overflow-y-auto styled-scrollbar pr-2">
              {incomes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 rounded-full bg-muted mb-4">
                    <Wallet className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-base font-medium">No income entries yet</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Start by adding your first income source
                  </p>
                  <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Income
                  </Button>
                </div>
              ) : filteredIncomes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 rounded-full bg-muted mb-4">
                    <Search className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-base font-medium">No matching results</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Try adjusting your search or filter criteria
                  </p>
                  <Button variant="outline" onClick={clearFilters} className="gap-2">
                    <X className="w-4 h-4" />
                    Clear Filters
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredIncomes.map((income) => (
                    <div
                      key={income.id}
                      className={cn(
                        "group flex items-center justify-between gap-4 p-4 rounded-xl",
                        "border border-border/50 bg-background",
                        "hover:bg-secondary/30 hover:border-border",
                        "transition-all duration-200"
                      )}
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="p-2.5 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                          {getCategoryIcon(income.category)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium truncate">{income.name}</h4>
                            {income.isrecurring && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-5 gap-1 border-chart-2/30 text-chart-2 flex-shrink-0"
                              >
                                <RefreshCw className="w-2.5 h-2.5" />
                                {income.recurringfrequency || "Recurring"}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-normal">
                              {income.category}
                            </Badge>
                            <span>{income.source}</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(income.date), "MMM d, yyyy")}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <p className="text-base font-semibold">
                          {formatCurrency(Number(income.amount))}
                        </p>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(income)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(income)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Income Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Add New Income</DialogTitle>
            <DialogDescription>Create a new income entry to track</DialogDescription>
          </DialogHeader>
          <IncomeForm onSubmit={handleAddIncome} submitLabel="Add Income" />
        </DialogContent>
      </Dialog>

      {/* Edit Income Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Edit Income</DialogTitle>
            <DialogDescription>Update the income entry details</DialogDescription>
          </DialogHeader>
          {selectedIncome && (
            <IncomeForm
              key={selectedIncome.id}
              onSubmit={handleUpdateIncome}
              submitLabel="Save Changes"
              defaultValues={{
                name: selectedIncome.name,
                amount: Number(selectedIncome.amount),
                date: new Date(selectedIncome.date),
                category: selectedIncome.category as "Salary" | "Bonus" | "Investment" | "Freelance" | "Business" | "Other",
                source: selectedIncome.source as "Employer" | "Self-Employment" | "Investments" | "Client" | "Family/Friend" | "Other",
                isRecurring: selectedIncome.isrecurring,
                recurringFrequency: selectedIncome.recurringfrequency,
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-destructive/10">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <DialogTitle>Delete Income</DialogTitle>
                <DialogDescription className="mt-1">
                  This action cannot be undone
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedIncome && (
            <div className="p-4 rounded-xl bg-secondary/50 my-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{selectedIncome.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedIncome.category} · {format(new Date(selectedIncome.date), "MMM d, yyyy")}
                  </p>
                </div>
                <p className="text-lg font-semibold">
                  {formatCurrency(Number(selectedIncome.amount))}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedIncome && deleteMutation.mutate(selectedIncome.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
