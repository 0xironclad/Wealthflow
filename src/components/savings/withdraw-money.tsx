import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DialogClose } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSavings } from "@/server/saving";
import { Saving } from "@/lib/types";
import { useUser } from "@/context/UserContext";

interface WithdrawMoneyProps {
  savingId: number;
  onClose?: () => void;
}
const formSchema = z.object({
  amount: z.coerce
    .number()
    .min(0.01, "Amount must be greater than 0")
    .refine((val) => !isNaN(val), {
      message: "Amount must be a valid number",
    }),
});
type FormData = z.infer<typeof formSchema>;


export default function WithdrawMoneyModal({ savingId, onClose }: WithdrawMoneyProps) {
  const { user } = useUser();

  const queryClient = useQueryClient();
  const { data: savings } = useQuery({
    queryKey: ["savings", user?.id],
    enabled: !!user?.id,
    queryFn: () => getSavings(user?.id ?? ""),
    // Matches the other observers of this key (dashboard, savings accounts grid).
    staleTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
  });
  const currentSaving = savings?.find((s: Saving) => s.id === savingId);
  const availableBalance = currentSaving?.amount || 0;
  const updateSavingMutation = useMutation({
    mutationFn: async (amount: number) => {
      const response = await fetch("/api/savings/withdraw", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: savingId, amount }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to withdraw amount");
      }
      return response.json();
    },
    onSuccess: (data, amount) => {
      queryClient.invalidateQueries({ queryKey: ["savings", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["savingsHistory"] });
      const time = new Date();
      toast.success("Money withdrawn successfully", {
        description: `$${amount.toLocaleString()} has been withdrawn from your savings goal at ${time.toLocaleString("en-US", {
          hour: "numeric",
          minute: "numeric",
          hour12: true,
        })}`,
      });
      setTimeout(() => {
        onClose?.();
      }, 100);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to withdraw amount"
      );
    },
  });
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
    },
    mode: "onChange",
  });
  const isExceedingBalance = form.watch("amount") > availableBalance;
  const isFormValid =
    form.formState.isValid &&
    !isExceedingBalance &&
    form.getValues("amount") > 0;
  async function handleSubmit(values: FormData) {
    if (values.amount > availableBalance) {
      form.setError("amount", {
        type: "manual",
        message: "Amount cannot exceed your available balance",
      });
      return;
    }
    try {
      await updateSavingMutation.mutateAsync(values.amount);
    } catch (error) {
      console.error("Error withdrawing money:", error);
    }
  }
  return (
    <Card className="w-full">
      {" "}
      <CardHeader>
        <CardTitle>Withdraw Money</CardTitle>{" "}
      </CardHeader>
      <CardContent>
        {" "}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <div>
              {" "}
              <div className="mb-4">
                <label className="text-sm text-muted-foreground">
                  {" "}
                  Available Balance
                </label>{" "}
                <div className="mt-2 flex items-center border rounded-md p-3">
                  <span className="text-2xl mr-2">$</span>{" "}
                  <span className="text-2xl">{availableBalance}</span>
                </div>{" "}
              </div>
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>{" "}
                    <div className="flex items-center">
                      <span className="text-2xl mr-2">$</span>{" "}
                      <FormControl>
                        <Input
                          placeholder="0.00"
                          type="number"
                          step="0.01"
                          min="0"
                          className="text-2xl"
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value === "" ? 0 : Number(value));
                          }}
                        />
                      </FormControl>{" "}
                    </div>
                    <FormMessage />{" "}
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" className="w-full">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={!isFormValid || form.formState.isSubmitting}
                className="w-full"
              >
                Withdraw Money
              </Button>
            </div>
          </form>
        </Form>{" "}
      </CardContent>
    </Card>
  );
}
