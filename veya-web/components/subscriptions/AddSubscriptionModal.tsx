"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal } from "@/components/ui/Modal";
import { SUBSCRIPTION_CATEGORIES, categorySelectLabel } from "@/lib/categories";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";

const schema = z.object({
  name: z.string().min(1, "Name required"),
  category: z.string().min(1, "Category required"),
  price: z.number().positive("Must be positive"),
  billingCycle: z.enum(["monthly", "yearly", "weekly", "custom"]),
  startDate: z.string().min(1),
  nextRenewal: z.string().min(1),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface AddSubscriptionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
  defaultDate?: string;
}

export function AddSubscriptionModal({
  open,
  onClose,
  onSubmit,
  defaultDate,
}: AddSubscriptionModalProps) {
  const today = defaultDate ?? new Date().toISOString().slice(0, 10);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      billingCycle: "monthly",
      startDate: today,
      nextRenewal: today,
    },
  });

  const startDate = watch("startDate");
  const nextRenewal = watch("nextRenewal");

  const handleFormSubmit = async (data: FormData) => {
    setSubmitError(null);
    try {
      await onSubmit(data);
      reset();
      onClose();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not add subscription.");
    }
  };

  return (
    <Modal open={open} fullScreenMobile onClose={onClose} title="Add subscription">
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        {/* Hidden registrations for portal-based date inputs (ensures values are submitted reliably). */}
        <input type="hidden" {...register("startDate")} />
        <input type="hidden" {...register("nextRenewal")} />

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Name
          </label>
          <Input {...register("name")} placeholder="Netflix" />
          {errors.name && (
            <p className="mt-1 text-sm text-danger">{errors.name.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Category
          </label>
          <select
            {...register("category")}
            className="w-full rounded-xl border border-border bg-background-secondary px-4 py-3 text-text-primary focus:border-accent focus:outline-none"
          >
            <option value="">Select...</option>
            {SUBSCRIPTION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categorySelectLabel(c)}
              </option>
            ))}
          </select>
          {errors.category && (
            <p className="mt-1 text-sm text-danger">{errors.category.message}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Price
            </label>
            <Input
              type="number"
              step="0.01"
              {...register("price", { valueAsNumber: true })}
              placeholder="9.99"
            />
            {errors.price && (
              <p className="mt-1 text-sm text-danger">{errors.price.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Billing
            </label>
            <select
              {...register("billingCycle")}
              className="w-full rounded-xl border border-border bg-background-secondary px-4 py-3 text-text-primary focus:border-accent focus:outline-none"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="weekly">Weekly</option>
              <option value="custom">Custom (price = /mo)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Start date
            </label>
            <DateInput
              value={startDate}
              onChange={(v) => setValue("startDate", v, { shouldDirty: true, shouldValidate: true })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Next renewal
            </label>
            <DateInput
              value={nextRenewal}
              onChange={(v) => setValue("nextRenewal", v, { shouldDirty: true, shouldValidate: true })}
            />
            {errors.nextRenewal && (
              <p className="mt-1 text-sm text-danger">{errors.nextRenewal.message}</p>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Notes (optional)
          </label>
          <textarea
            {...register("notes")}
            className="w-full rounded-xl border border-border bg-background-secondary px-4 py-3 text-text-primary placeholder-text-tertiary focus:border-accent focus:outline-none min-h-[80px]"
            placeholder="Optional notes"
          />
        </div>
        <div className="flex gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} className="flex-1">
            Add
          </Button>
        </div>
        {submitError && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {submitError}
          </p>
        )}
      </form>
    </Modal>
  );
}
