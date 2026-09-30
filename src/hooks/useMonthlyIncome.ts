import { useQuery } from '@tanstack/react-query'
import { getCurrentMonthIncomeTotal, getMonthlyIncomeTotal } from '@/server/income-queries'

export function useCurrentMonthIncome(userId: string) {
    return useQuery({
        queryKey: ['monthly-income', userId, 'current'],
        queryFn: () => getCurrentMonthIncomeTotal(),
        enabled: !!userId,
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    })
}

export function useMonthlyIncome(userId: string, year?: number, month?: number) {
    return useQuery({
        queryKey: ['monthly-income', userId, year, month],
        queryFn: () => getMonthlyIncomeTotal(year, month),
        enabled: !!userId,
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    })
}

export type MonthlyIncomeData = {
    totalIncome: number
    incomeCount: number
    averageIncome: number
    dateRange: {
        from: string | null
        to: string | null
    }
}
