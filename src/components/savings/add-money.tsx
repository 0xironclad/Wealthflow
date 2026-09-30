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
import { getTotalIncome } from "@/server/income-queries";
import { useUser } from "@/context/UserContext";

interface AddMoneyFormProps {
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

export default function AddMoneyForm({ savingId, onClose }: AddMoneyFormProps) {
  const { user } = useUser();

  const queryClient = useQueryClient();
  const { data: totalBalance } = useQuery({
    queryKey: ["totalBalance", user?.id],
    enabled: !!user?.id,
    queryFn: () => getTotalIncome(),
  });

  const updateSavingMutation = useMutation({
    mutationFn: async (amount: number) => {
      const response = await fetch("/api/savings/amount", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: savingId, amount }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update saving amount");
      }

      return response.json();
    },
    onSuccess: (data, amount) => {
      queryClient.invalidateQueries({ queryKey: ["savings", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["savingsHistory"] });
      const time = new Date();
      toast.success("Money added successfully", {
        description: `$${amount.toLocaleString()} has been added to your savings goal at ${time.toLocaleString("en-US", {
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
        error instanceof Error ? error.message : "Failed to add amount"
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

  const isExceedingBalance = form.watch("amount") > (totalBalance ?? 0);
  const isFormValid =
    form.formState.isValid &&
    !isExceedingBalance &&
    form.getValues("amount") > 0;

  async function handleSubmit(values: FormData) {
    if (values.amount > (totalBalance ?? 0)) {
      form.setError("amount", {
        type: "manual",
        message: "Amount cannot exceed your available balance",
      });
      return;
    }

    try {
      await updateSavingMutation.mutateAsync(values.amount);
    } catch (error) {
      console.error("Error adding money:", error);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Add Money</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <div>
              <div className="mb-4">
                <label className="text-sm text-muted-foreground">
                  Available Balance
                </label>
                <div className="mt-2 flex items-center border rounded-md p-3">
                  <span className="text-2xl mr-2">$</span>
                  <span className="text-2xl">{totalBalance}</span>
                </div>
              </div>

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <div className="flex items-center">
                      <span className="text-2xl mr-2">$</span>
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
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={!isFormValid || form.formState.isSubmitting}
              >
                Add Money
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
