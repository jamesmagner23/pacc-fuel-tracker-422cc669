import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type ExpenseFrequency = "weekly" | "fortnightly" | "monthly" | "quarterly" | "annual" | "one_off";

export interface OperatingExpense {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: ExpenseFrequency;
  next_due_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type OperatingExpenseInput = Omit<OperatingExpense, "id" | "created_at" | "updated_at">;

const QK = ["operating_expenses"] as const;

export function useOperatingExpenses() {
  return useQuery({
    queryKey: QK,
    queryFn: async (): Promise<OperatingExpense[]> => {
      const { data, error } = await supabase
        .from("operating_expenses")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OperatingExpense[];
    },
  });
}

export function useUpsertExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<OperatingExpense> & OperatingExpenseInput) => {
      const payload = { ...input, amount: Number(input.amount) || 0 };
      if (input.id) {
        const { data, error } = await supabase
          .from("operating_expenses")
          .update(payload)
          .eq("id", input.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("operating_expenses")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      toast({ title: "Expense saved" });
    },
    onError: (err: any) => {
      toast({ title: "Could not save expense", description: err?.message ?? "Unknown error", variant: "destructive" });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("operating_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      toast({ title: "Expense removed" });
    },
  });
}

// Convert a single recurring expense to a daily rate (one_off → 0 daily contribution).
export function dailyRateFor(exp: Pick<OperatingExpense, "amount" | "frequency">): number {
  const a = Number(exp.amount) || 0;
  switch (exp.frequency) {
    case "weekly": return a / 7;
    case "fortnightly": return a / 14;
    case "monthly": return a / 30.4375;
    case "quarterly": return a / 91.3125;
    case "annual": return a / 365.25;
    case "one_off": return 0;
    default: return 0;
  }
}

export const FREQUENCY_LABEL: Record<ExpenseFrequency, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  one_off: "One-off",
};
