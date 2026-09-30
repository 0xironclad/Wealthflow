"use client"

import { useUser } from "@/context/UserContext";
import { IncomeType, InvoiceType } from "@/lib/types";
import { getExpensesById } from "@/server/expense";
import { getIncomesById, getTotalIncome } from "@/server/income";
import { useQuery } from "@tanstack/react-query";
import logo from "@/assets/icon.png";
import Image from "next/image";
import {
    Calendar,
    TrendingUp,
    TrendingDown,
    Receipt,
    User,
    PieChart,
    ArrowUpRight,
    ArrowDownRight
} from "lucide-react";

function InvoicePage() {
    const { user } = useUser();

    //   total income for the month
    const { data: incomes } = useQuery({
        queryKey: ['incomes', user?.id],
        refetchOnWindowFocus: false,
        queryFn: async () => {
            if (!user) return Promise.resolve([]);
            return getIncomesById();
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 60,
    });

    const today = new Date();

    const totalIncomeThisMonth = incomes
        ?.filter((income: IncomeType) => {
            const incomeDate = new Date(income.date);
            return incomeDate.getMonth() === today.getMonth() &&
                incomeDate.getFullYear() === today.getFullYear();
        })
        .reduce((sum: number, income: IncomeType) => {
            const amount = typeof income.amount === 'string'
                ? parseFloat(income.amount)
                : Number(income.amount);
            return sum + (isNaN(amount) ? 0 : amount);
        }, 0) ?? 0;

    //   total expenses for the month
    const { data: expenses } = useQuery({
        queryKey: ['expenses', user?.id],
        refetchOnWindowFocus: false,
        queryFn: async () => {
            if (!user) return Promise.resolve([]);
            return getExpensesById(user.id);
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 60,
    });

    const totalExpensesThisMonth = expenses
        ?.filter((expense: InvoiceType) => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getMonth() === today.getMonth() &&
                expenseDate.getFullYear() === today.getFullYear() && expense.type === 'expense';
        })
        .reduce((sum: number, expense: InvoiceType) => sum + Number(expense.amount), 0) ?? 0;

    // Income
    const { data: totalIncome } = useQuery({
        queryKey: ['totalBalance', user?.id],
        queryFn: () => getTotalIncome(),
        refetchOnWindowFocus: false,
        enabled: !!user?.id,
        select: (response) => {
            const amount = Number(response);
            return `$${amount.toLocaleString()}`
        },
        retry: 1
    });


    if (!user) {
        return <div>Loading...</div>;
    }

    // Transactions for the month
    const transactions = expenses?.filter((expense: InvoiceType) => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === today.getMonth() &&
            expenseDate.getFullYear() === today.getFullYear() && expense.type === 'expense';
    })
        .sort((a: InvoiceType, b: InvoiceType) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    const currentMonth = monthNames[today.getMonth()];
    const currentYear = today.getFullYear();

    const netFlow = totalIncomeThisMonth - totalExpensesThisMonth;

    return (
        <div className="min-h-screen bg-white text-black p-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="border-b-2 border-gray-200 pb-8 mb-8">
                <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 rounded-lg flex items-center justify-center">
                            <Image src={logo} alt="WealthFlow" width={64} height={64} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">WealthFlow</h1>
                            <p className="text-gray-600">Financial Report</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className="text-2xl font-bold text-gray-900">{currentMonth} {currentYear}</h2>
                        <p className="text-gray-600">Monthly Financial Summary</p>
                        <div className="flex items-center space-x-2 mt-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-500">
                                Generated on {today.toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* User Information */}
            <div className="bg-gray-50 rounded-lg p-6 mb-8">
                <div className="flex items-center space-x-2 mb-4">
                    <User className="w-5 h-5 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Account Holder</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-gray-600">Name</p>
                        <p className="font-medium text-gray-900">{user.email?.split('@')[0] || 'User'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">User ID</p>
                        <p className="font-medium text-gray-900 font-mono">{user.id.slice(0, 8)}...</p>
                    </div>
                </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-green-600 uppercase tracking-wide">Monthly Income</p>
                            <p className="text-2xl font-bold text-green-900">${totalIncomeThisMonth.toLocaleString()}</p>
                        </div>
                        <div className="bg-green-100 rounded-full p-3">
                            <TrendingUp className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-red-600 uppercase tracking-wide">Monthly Expenses</p>
                            <p className="text-2xl font-bold text-red-900">${totalExpensesThisMonth.toLocaleString()}</p>
                        </div>
                        <div className="bg-red-100 rounded-full p-3">
                            <TrendingDown className="w-6 h-6 text-red-600" />
                        </div>
                    </div>
                </div>

                <div className={`${netFlow >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'} border rounded-lg p-6`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={`text-sm font-medium ${netFlow >= 0 ? 'text-blue-600' : 'text-orange-600'} uppercase tracking-wide`}>
                                Net Flow
                            </p>
                            <p className={`text-2xl font-bold ${netFlow >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>
                                ${Math.abs(netFlow).toLocaleString()}
                            </p>
                        </div>
                        <div className={`${netFlow >= 0 ? 'bg-blue-100' : 'bg-orange-100'} rounded-full p-3`}>
                            {netFlow >= 0 ?
                                <ArrowUpRight className={`w-6 h-6 ${netFlow >= 0 ? 'text-blue-600' : 'text-orange-600'}`} /> :
                                <ArrowDownRight className={`w-6 h-6 ${netFlow >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
                            }
                        </div>
                    </div>
                </div>
            </div>

            {/* Total Balance Section */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-6 text-white mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-green-100 text-sm font-medium uppercase tracking-wide">Total Balance</p>
                        <p className="text-3xl font-bold">{totalIncome || '$0'}</p>
                        <p className="text-green-100 text-sm mt-1">All-time accumulated balance</p>
                    </div>
                    <div className="bg-white/20 rounded-full p-4">
                        <PieChart className="w-8 h-8 text-white" />
                    </div>
                </div>
            </div>

            {/* Transaction Details */}
            <div className="mb-8">
                <div className="flex items-center space-x-2 mb-6">
                    <Receipt className="w-5 h-5 text-gray-600" />
                    <h3 className="text-xl font-semibold text-gray-900">Transaction History - {currentMonth} {currentYear}</h3>
                    <div className="bg-gray-100 rounded-full px-3 py-1">
                        <span className="text-sm font-medium text-gray-700">{transactions.length} transactions</span>
                    </div>
                </div>

                {transactions.length > 0 ? (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                            <div className="grid grid-cols-4 gap-4 text-sm font-medium text-gray-600 uppercase tracking-wide">
                                <div>Date</div>
                                <div>Description</div>
                                <div>Category</div>
                                <div className="text-right">Amount</div>
                            </div>
                        </div>
                        <div className="divide-y divide-gray-200">
                            {transactions.map((transaction: InvoiceType, index: number) => (
                                <div key={index} className="px-6 py-4 hover:bg-gray-50">
                                    <div className="grid grid-cols-4 gap-4 items-center">
                                        <div className="text-sm text-gray-900">
                                            {new Date(transaction.date).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </div>
                                        <div className="text-sm font-medium text-gray-900">
                                            {transaction.name}
                                        </div>
                                        <div>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                {transaction.category}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-semibold text-red-600">
                                                -${Number(transaction.amount).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                        <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No transactions found for {currentMonth} {currentYear}</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 pt-6 text-center">
                <p className="text-sm text-gray-500">
                    This report was generated automatically by WealthFlow Financial Management System
                </p>
                <p className="text-xs text-gray-400 mt-2">
                    For questions or support, please contact your financial advisor
                </p>
            </div>
        </div>
    )
}

export default InvoicePage;
