"use client"

import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { InvoiceType } from "@/lib/types"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import TransactionDetails from "./transaction-details"
import { useQuery } from "@tanstack/react-query"
import { getExpensesById } from "@/server/expense"
import { useUser } from "@/context/UserContext"
import useDebounce from "@/hooks/debounce"

function TransactionsTableSearchBar() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedExpense, setSelectedExpense] = useState<InvoiceType | null>(null)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<InvoiceType[]>([])
  const debouncedQuery = useDebounce(query, 200)

  const { user } = useUser()

  const { data: expenses } = useQuery({
    queryKey: ["expenses", user?.id],
    queryFn: () => (user ? getExpensesById(user.id) : null),
    enabled: !!user,
    // Same staleTime as the transaction page's query on this key.
    staleTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    select: (data) =>
      data?.map(
        (expense: {
          id: number
          userid: number
          name: string
          date: string
          amount: string
          type: string
          paymentmethod: string
          category: string
        }) => ({
          id: expense.id,
          userId: expense.userid,
          name: expense.name,
          date: expense.date,
          amount: Number.parseFloat(expense.amount),
          type: expense.type,
          paymentMethod: expense.paymentmethod,
          category: expense.category,
        }),
      ),
  })

  useEffect(() => {
    if (expenses) {
      setSearchResults(expenses)
    }
  }, [expenses])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  useEffect(() => {
    if (!expenses) return

    const filtered = expenses.filter(
      (expense: InvoiceType) =>
        expense.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        expense.category.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        expense.type.toLowerCase().includes(debouncedQuery.toLowerCase()),
    )
    setSearchResults(filtered)
  }, [debouncedQuery, expenses])

  const handleSearch = (value: string) => {
    setQuery(value)
  }

  const handleItemClick = (expense: InvoiceType) => {
    setSelectedExpense(expense)
    setPopoverOpen(true)
    setOpen(false)
  }

  const handleEdit = (expense: InvoiceType) => {
    // TODO: Implement edit functionality
    console.log("Edit expense:", expense)
    setPopoverOpen(false)
  }

  const handleDelete = (id: number) => {
    // TODO: Implement delete functionality
    console.log("Delete expense with id:", id)
    setPopoverOpen(false)
  }


  const item = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
      },
    },
    exit: {
      opacity: 0,
      y: -10,
      transition: {
        duration: 0.2,
      },
    },
  }

  if (!user) return null

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="relative h-9 w-full justify-start rounded-[0.5rem] text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64"
            onClick={() => setOpen(true)}
          >
            <Search className="mr-2 h-4 w-4" />
            <span className="hidden lg:inline-flex">Search transactions...</span>
            <span className="inline-flex lg:hidden">Search...</span>
            <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          {selectedExpense && (
            <TransactionDetails
              expense={selectedExpense}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </PopoverContent>
      </Popover>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <div className="rounded-lg border shadow-md">
          <DialogHeader>
            <VisuallyHidden>
              <DialogTitle>Search Transactions</DialogTitle>
            </VisuallyHidden>
          </DialogHeader>
          <div className="relative">
            <CommandInput placeholder="Search transactions..." value={query} onValueChange={handleSearch} />
          </div>
          <div>
            <CommandList>
              {searchResults.length === 0 && <CommandEmpty>No results found.</CommandEmpty>}
              <div>
                <CommandGroup heading="Transactions">
                  <AnimatePresence>
                    {searchResults.map((expense) => (
                      <motion.div key={expense.id} variants={item} initial="hidden" animate="show" exit="exit" layout>
                        <CommandItem
                          key={expense.id}
                          value={`${expense.name}-${expense.category}-${expense.type}`}
                          onSelect={() => handleItemClick(expense)}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <span>{expense.name}</span>
                              <span className="text-sm text-muted-foreground">in {expense.category}</span>
                            </div>
                            <span
                              className={cn("text-sm", expense.type === "income" ? "text-green-500" : "text-red-500")}
                            >
                              ${expense.amount.toFixed(2)}
                            </span>
                          </div>
                        </CommandItem>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </CommandGroup>
              </div>
              <div className="mt-2 px-3 py-2 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Press ⌘K to open commands</span>
                  <span>ESC to cancel</span>
                </div>
              </div>
            </CommandList>
          </div>
        </div>
      </CommandDialog>
    </>
  )
}

export default TransactionsTableSearchBar
