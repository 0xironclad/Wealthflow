"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
    Plus,
    TrendingUp,
    Target,
    PiggyBank,
    Receipt,
    BarChart3
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { TransactionForm } from "@/components/transaction-form"
import { IncomeForm } from "@/components/income/income-form"
import { EditBudgetForm } from "@/components/budget/budget-form"
import SavingForm from "@/components/savings/saving-form"
import { InvoiceType, Saving, Budget } from "@/lib/types"

interface QuickAction {
    id?: string;
    label?: string;
    icon?: React.ComponentType<{ className?: string }>;
    href?: string | null;
    color?: string;
    description?: string;
    action?: string;
}

interface IncomeFormData {
    name: string;
    date: Date;
    amount: number;
    category: string;
    source: string;
    isRecurring: boolean;
    recurringFrequency?: string;
}
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createExpense } from "@/server/expense"
import { createIncome } from "@/server/income"

import { useToast } from "@/hooks/use-toast"
import { useUser } from "@/context/UserContext"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"


const quickActions = [
    {
        id: "add-transaction",
        label: "Add Transaction",
        icon: Receipt,
        href: null,
        color: "bg-blue-500 hover:bg-blue-600",
        description: "Record income or expense",
        action: "open-transaction-form"
    },
    {
        id: "add-income",
        label: "Add Income",
        icon: TrendingUp,
        href: null,
        color: "bg-green-500 hover:bg-green-600",
        description: "Track your earnings",
        action: "open-income-form"
    },
    {
        id: "create-budget",
        label: "Create Budget",
        icon: Target,
        href: null,
        color: "bg-purple-500 hover:bg-purple-600",
        description: "Set spending limits",
        action: "open-budget-form"
    },
    {
        id: "add-savings",
        label: "Add Savings",
        icon: PiggyBank,
        href: null,
        color: "bg-yellow-500 hover:bg-yellow-600",
        description: "Build your wealth",
        action: "open-savings-form"
    },
    {
        id: "view-insights",
        label: "View Insights",
        icon: BarChart3,
        href: "/insights",
        color: "bg-indigo-500 hover:bg-indigo-600",
        description: "AI-powered analysis"
    }
]

export default function QuickActions() {
    const [isOpen, setIsOpen] = useState(false)
    const [showTransactionForm, setShowTransactionForm] = useState(false)
    const [showIncomeForm, setShowIncomeForm] = useState(false)
    const [showBudgetForm, setShowBudgetForm] = useState(false)
    const [showSavingsForm, setShowSavingsForm] = useState(false)
    const { user } = useUser()
    const { toast } = useToast()
    const queryClient = useQueryClient()

    const createTransactionMutation = useMutation({
        mutationFn: (newInvoice: Omit<InvoiceType, "id">) => createExpense(newInvoice),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
            queryClient.invalidateQueries({ queryKey: ['budgetTotal'] });
            queryClient.invalidateQueries({ queryKey: ['totalBalance'] });
            setShowTransactionForm(false);
            setIsOpen(false);
            const time = new Date();
            toast({
                title: "Transaction added successfully",
                description: time.toLocaleString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                    hour12: true,
                }),
                action: (
                    <Button variant="outline" size="sm" onClick={() => window.location.href = '/transaction'}>
                        View Transactions
                    </Button>
                ),
            });
        },
        onError: (error) => {
            toast({
                title: "Error adding transaction",
                description: error instanceof Error ? error.message : "Unknown error occurred",
                variant: "destructive"
            });
        }
    });

    const createIncomeMutation = useMutation({
        mutationFn: (newIncome: {
            name: string;
            amount: number;
            date: Date;
            category: string;
            source: string;
            isRecurring: boolean;
            recurringFrequency?: string;
        }) =>
            createIncome(newIncome),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['incomes', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['monthly-income', user?.id] })
            queryClient.invalidateQueries({ queryKey: ['totalBalance', user?.id] })
            queryClient.invalidateQueries({ queryKey: ['savingsHistory'] })
            setShowIncomeForm(false);
            setIsOpen(false);
            const time = new Date();
            toast({
                title: "Income added successfully",
                description: time.toLocaleString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                    hour12: true,
                }),
                action: (
                    <Button variant="outline" size="sm" onClick={() => window.location.href = '/income'}>
                        View Income
                    </Button>
                ),
            });
        },
        onError: (error) => {
            toast({
                title: "Error adding income",
                description: error instanceof Error ? error.message : "Unknown error occurred",
                variant: "destructive"
            });
        }
    });



    const handleTransactionSubmit = (formData: Partial<InvoiceType>) => {
        if (!user) {
            toast({
                title: "Error",
                description: "User not authenticated",
                variant: "destructive"
            });
            return;
        }

        if (
            formData.name &&
            formData.date &&
            formData.amount &&
            formData.type &&
            formData.paymentMethod &&
            formData.category
        ) {
            createTransactionMutation.mutate({
                userId: user.id,
                name: formData.name,
                date: formData.date,
                amount: formData.amount,
                type: formData.type,
                paymentMethod: formData.paymentMethod,
                category: formData.category
            });
        }
    }

    const handleIncomeSubmit = (formData: IncomeFormData) => {
        if (!user) {
            toast({
                title: "Error",
                description: "User not authenticated",
                variant: "destructive"
            });
            return;
        }

        if (
            formData.name &&
            formData.date &&
            formData.amount &&
            formData.category &&
            formData.source
        ) {
            createIncomeMutation.mutate({
                name: formData.name,
                date: formData.date,
                amount: formData.amount,
                category: formData.category,
                source: formData.source,
                isRecurring: formData.isRecurring,
                recurringFrequency: formData.recurringFrequency
            });
        }
    }

    const handleTransactionCancel = () => {
        setShowTransactionForm(false)
        setIsOpen(false)
    }

    const handleIncomeCancel = () => {
        setShowIncomeForm(false)
        setIsOpen(false)
    }

    const handleBudgetSubmit = (budgetData: Budget) => {
        // The EditBudgetForm already handles the creation via createBudget server function
        // We just need to handle the success case
        if (budgetData) {
            setShowBudgetForm(false);
            setIsOpen(false);
            const time = new Date();
            toast({
                title: "Budget created successfully",
                description: time.toLocaleString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                    hour12: true,
                }),
                action: (
                    <Button variant="outline" size="sm" onClick={() => window.location.href = '/budget'}>
                        View Budgets
                    </Button>
                ),
            });
        }
    }

    const handleBudgetCancel = () => {
        setShowBudgetForm(false)
        setIsOpen(false)
    }

    const handleSavingsSubmit = (savingData: Saving) => {
        // The SavingForm already handles the creation via useCreateSaving
        // We just need to handle the success case
        if (savingData) {
            setShowSavingsForm(false);
            setIsOpen(false);
            const time = new Date();
            toast({
                title: "Savings goal created successfully",
                description: time.toLocaleString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                    hour12: true,
                }),
                action: (
                    <Button variant="outline" size="sm" onClick={() => window.location.href = '/goals'}>
                        View Goals
                    </Button>
                ),
            });
        }
    }



    const handleActionClick = (action: QuickAction) => {
        if (action.action === "open-transaction-form") {
            setShowTransactionForm(true)
        } else if (action.action === "open-income-form") {
            setShowIncomeForm(true)
        } else if (action.action === "open-budget-form") {
            setShowBudgetForm(true)
        } else if (action.action === "open-savings-form") {
            setShowSavingsForm(true)
        } else if (action.href) {
            window.location.href = action.href
        }
    }

    return (
        <div className="fixed bottom-6 right-24 z-50">
            {/* Backdrop blur when open */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm -z-10"
                        onClick={() => setIsOpen(false)}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{
                            opacity: 0,
                            scale: 0.8,
                            y: 20,
                            transition: { duration: 0.15 }
                        }}
                        transition={{
                            duration: 0.25,
                            ease: "easeOut"
                        }}
                        className="mb-4 space-y-2"
                    >
                        {quickActions.map((action, index) => (
                            <motion.div
                                key={action.id}
                                initial={{
                                    opacity: 0,
                                    x: 50,
                                    scale: 0.8,
                                    rotateY: -15
                                }}
                                animate={{
                                    opacity: 1,
                                    x: 0,
                                    scale: 1,
                                    rotateY: 0
                                }}
                                exit={{
                                    opacity: 0,
                                    x: 50,
                                    scale: 0.8,
                                    rotateY: 15,
                                    transition: {
                                        duration: 0.15,
                                        delay: (quickActions.length - index - 1) * 0.03
                                    }
                                }}
                                transition={{
                                    duration: 0.3,
                                    delay: index * 0.05,
                                    ease: "easeOut"
                                }}
                                whileHover={{
                                    scale: 1.02,
                                    x: -5,
                                    transition: { duration: 0.2 }
                                }}
                            >
                                <Card
                                    className="w-64 cursor-pointer group"
                                    onClick={() => handleActionClick(action)}
                                >
                                    <CardContent className="p-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${action.color} text-white transition-transform group-hover:scale-110`}>
                                                <action.icon className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium text-sm">{action.label}</p>
                                                <p className="text-xs text-muted-foreground">{action.description}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div
                whileHover={{
                    scale: 1.05
                }}
                whileTap={{ scale: 0.95 }}
            >
                <Button
                    onClick={() => setIsOpen(!isOpen)}
                    size="lg"
                    className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 transition-all duration-200 relative overflow-hidden"
                >
                    <motion.div
                        animate={{
                            rotate: isOpen ? 45 : 0,
                            scale: isOpen ? 1.1 : 1
                        }}
                        transition={{
                            duration: 0.3,
                            ease: "easeInOut"
                        }}
                        className="relative z-10"
                    >
                        <Plus className="h-6 w-6" />
                    </motion.div>

                    {/* Ripple effect */}
                    <motion.div
                        className="absolute inset-0 rounded-full bg-white/20"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={isOpen ? { scale: 1.5, opacity: 0 } : { scale: 0, opacity: 0 }}
                        transition={{ duration: 0.4 }}
                    />
                </Button>
            </motion.div>

            {/* Transaction Form Modal */}
            {showTransactionForm && (
                <TransactionForm
                    mode="add"
                    onSubmit={handleTransactionSubmit}
                    onCancel={handleTransactionCancel}
                />
            )}

            {/* Income Form Modal */}
            {showIncomeForm && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                    <div className="bg-background p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
                        <IncomeForm onSubmit={handleIncomeSubmit} />
                        <div className="flex justify-end gap-4 mt-4">
                            <Button variant="outline" onClick={handleIncomeCancel}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Budget Form Modal */}
            <Dialog open={showBudgetForm} onOpenChange={setShowBudgetForm}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create Budget</DialogTitle>
                    </DialogHeader>
                    {user && (
                        <EditBudgetForm
                            budget={{
                                id: 0, // 0 indicates new budget creation
                                userId: user.id,
                                name: "",
                                description: "",
                                periodType: "monthly",
                                startDate: new Date().toISOString(),
                                endDate: new Date().toISOString(),
                                category: "Food",
                                plannedAmount: 0,
                                spentAmount: 0,
                                rollOver: false,
                            }}
                            onSuccessfulSubmit={handleBudgetSubmit}
                        />
                    )}
                    <div className="flex justify-end gap-4 mt-4">
                        <Button variant="outline" onClick={handleBudgetCancel}>
                            Cancel
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Savings Form Modal */}
            <Dialog open={showSavingsForm} onOpenChange={setShowSavingsForm}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create Savings Goal</DialogTitle>
                    </DialogHeader>
                    {user && (
                        <SavingForm
                            onSuccessfulSubmit={handleSavingsSubmit}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
