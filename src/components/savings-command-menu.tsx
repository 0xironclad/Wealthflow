"use client";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandDialog,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SavingsType } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { getSavings } from "@/server/saving";
import { useUser } from "@/context/UserContext";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";


export function SavingsCommandMenu() {
  const [open, setOpen] = useState(false);
  const [selectedSaving, setSelectedSaving] = useState<SavingsType | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SavingsType[]>([]);

  const { user } = useUser();

  const { data: savings } = useQuery({
    queryKey: ['savings', user?.id],
    queryFn: () => getSavings(user?.id ?? ''),
    enabled: !!user?.id,
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
  });

  useEffect(() => {
    if (savings) {
      setSearchResults(savings);
    }
  }, [savings]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSearch = (query: string) => {
    if (!savings) return;

    const filtered = savings.filter(
      (saving: SavingsType) =>
        saving.name.toLowerCase().includes(query.toLowerCase()) ||
        saving.status.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResults(filtered);
  };

  const handleItemClick = (saving: SavingsType) => {
    setSelectedSaving(saving);
    setPopoverOpen(true);
    setOpen(false);
  };

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
            <span className="hidden lg:inline-flex">Search savings...</span>
            <span className="inline-flex lg:hidden">Search...</span>
            <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          {selectedSaving && (
            <div className="space-y-4">
              <div className="flex justify-between">
                <h3 className="font-semibold">{selectedSaving.name}</h3>
                <span className={cn(
                  "px-2 py-1 rounded-full text-xs",
                  selectedSaving.status === "completed" ? "bg-primary/10 text-primary" :
                    selectedSaving.status === "active" ? "bg-blue-100 text-blue-600" :
                      "bg-amber-100 text-amber-600"
                )}>
                  {selectedSaving.status}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Progress</span>
                  <span className="text-sm font-medium">
                    ${selectedSaving.amount} / ${selectedSaving.goal}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.min((selectedSaving.amount / selectedSaving.goal) * 100, 100)}%`
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
            <VisuallyHidden>
              <DialogTitle>Search Goals</DialogTitle>
            </VisuallyHidden>
        </DialogHeader>
        <Command className="rounded-lg border shadow-md">
          <CommandInput
            placeholder="Search goals..."
            onValueChange={handleSearch}
          />
          <CommandList>
            <CommandEmpty>No goals found.</CommandEmpty>
            <CommandGroup heading="Goals">
              {searchResults.map((saving) => (
                <CommandItem
                  key={saving.id}
                  value={`${saving.name}-${saving.status}`}
                  onSelect={() => handleItemClick(saving)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <span>{saving.name}</span>
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs", saving.status === "completed" ? "text-primary" :
                        saving.status === "active" ? "text-blue-600" :
                          " text-amber-600"

                      )}>
                        {saving.status}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      ${saving.amount} / ${saving.goal}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
