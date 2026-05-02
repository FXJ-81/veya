"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal } from "@/components/ui/Modal";
import { SUBSCRIPTION_CATEGORIES, categorySelectLabel } from "@/lib/categories";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { toDateInputValue } from "@/lib/utils";
import type { Subscription } from "@/types";
import { parseSubscriptionCalendarDateInput, utcCalendarDateKey } from "@/lib/subscriptionBilling";

const schema = z
  .object({
    name: z.string().min(1, "Name required"),
    category: z.string().min(1, "Category required"),
    price: z.number().positive("Must be positive"),
    hasUpcomingPriceChange: z.boolean().optional(),
    upcomingPrice: z.number().positive("Must be positive").optional(),
    upcomingPriceEffectiveAt: z.string().optional(),
    billingCycle: z.enum(["monthly", "yearly", "weekly", "custom"]),
    startDate: z.string().min(1),
    nextRenewal: z.string().min(1),
    planEndsAt: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.hasUpcomingPriceChange) {
      if (!(typeof val.upcomingPrice === "number" && Number.isFinite(val.upcomingPrice))) {
        ctx.addIssue({ code: "custom", path: ["upcomingPrice"], message: "New price required" });
      }
      if (!val.upcomingPriceEffectiveAt?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["upcomingPriceEffectiveAt"],
          message: "Effective date required",
        });
      }
    }
    const endRaw = val.planEndsAt?.trim();
    if (!endRaw) return;
    const end = parseSubscriptionCalendarDateInput(endRaw);
    const start = parseSubscriptionCalendarDateInput(val.startDate);
    const endKey = utcCalendarDateKey(end);
    const startKey = utcCalendarDateKey(start);
    if (!endKey || !startKey) {
      ctx.addIssue({ code: "custom", path: ["planEndsAt"], message: "Invalid end date." });
      return;
    }
    if (endKey < startKey) {
      ctx.addIssue({
        code: "custom",
        path: ["planEndsAt"],
        message: "End date cannot be before start date.",
      });
    }
    if (val.hasUpcomingPriceChange && val.upcomingPriceEffectiveAt?.trim()) {
      const effKey = utcCalendarDateKey(
        parseSubscriptionCalendarDateInput(val.upcomingPriceEffectiveAt.trim()),
      );
      if (effKey && endKey < effKey) {
        ctx.addIssue({
          code: "custom",
          path: ["planEndsAt"],
          message: "Plan cannot end before the new price takes effect.",
        });
      }
    }
  });

type FormData = z.infer<typeof schema>;

interface EditSubscriptionModalProps {
  open: boolean;
  subscription: Subscription | null;
  onClose: () => void;
  onSubmit: (id: string, data: FormData) => Promise<void>;
}

export function EditSubscriptionModal({
  open,
  subscription,
  onClose,
  onSubmit,
}: EditSubscriptionModalProps) {
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
      name: "",
      category: "",
      price: 0,
      startDate: "",
      nextRenewal: "",
      notes: "",
      hasUpcomingPriceChange: false,
      upcomingPrice: undefined,
      upcomingPriceEffectiveAt: "",
      planEndsAt: "",
    },
  });

  const hasUpcomingPriceChange = watch("hasUpcomingPriceChange");
  const startDate = watch("startDate");
  const nextRenewal = watch("nextRenewal");
  const upcomingEff = watch("upcomingPriceEffectiveAt");
  const planEndsAt = watch("planEndsAt");
  const upcomingToggle = register("hasUpcomingPriceChange");

  useEffect(() => {
    if (!open || !subscription) return;
    setSubmitError(null);
    const bc = subscription.billingCycle;
    const billingCycle =
      bc === "monthly" || bc === "yearly" || bc === "weekly" || bc === "custom"
        ? bc
        : "monthly";
    reset({
      name: subscription.name,
      category: subscription.category,
      price: subscription.price,
      hasUpcomingPriceChange:
        typeof subscription.upcomingPrice === "number" && !!subscription.upcomingPriceEffectiveAt,
      upcomingPrice:
        typeof subscription.upcomingPrice === "number" ? subscription.upcomingPrice : undefined,
      upcomingPriceEffectiveAt: subscription.upcomingPriceEffectiveAt
        ? toDateInputValue(subscription.upcomingPriceEffectiveAt)
        : "",
      billingCycle,
      startDate: toDateInputValue(subscription.startDate),
      nextRenewal: toDateInputValue(subscription.nextRenewal),
      planEndsAt: subscription.planEndsAt ? toDateInputValue(subscription.planEndsAt) : "",
      notes: subscription.notes ?? "",
    });
  }, [open, subscription, reset]);

  const handleFormSubmit = async (data: FormData) => {
    if (!subscription) return;
    setSubmitError(null);
    const patch: FormData = { ...data };
    if (!data.hasUpcomingPriceChange) {
      patch.upcomingPrice = undefined;
      patch.upcomingPriceEffectiveAt = undefined;
    }
    try {
      await onSubmit(subscription.id, patch);
      onClose();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not save changes.");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit subscription">
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        {/* Hidden registrations for portal-based date inputs (ensures values are submitted reliably). */}
        <input type="hidden" {...register("startDate")} />
        <input type="hidden" {...register("nextRenewal")} />
        <input type="hidden" {...register("upcomingPriceEffectiveAt")} />
        <input type="hidden" {...register("planEndsAt")} />

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

        <div className="rounded-xl border border-border bg-background-secondary/20 p-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-text-primary">
            <input
              type="checkbox"
              className="mt-1 rounded border-border"
              name={upcomingToggle.name}
              ref={upcomingToggle.ref}
              checked={!!hasUpcomingPriceChange}
              onChange={(e) => upcomingToggle.onChange(e)}
              onBlur={upcomingToggle.onBlur}
            />
            <span className="min-w-0">
              <span className="block font-medium">Upcoming price change</span>
              <span className="mt-0.5 block text-xs text-text-tertiary">
                Keep current price until the effective date, then switch automatically.
              </span>
            </span>
          </label>

          {hasUpcomingPriceChange ? (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  New price
                </label>
                <Input
                  type="number"
                  step="0.01"
                  {...register("upcomingPrice", { valueAsNumber: true })}
                  placeholder="12.99"
                />
                {errors.upcomingPrice && (
                  <p className="mt-1 text-sm text-danger">{errors.upcomingPrice.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Effective date
                </label>
                <DateInput
                  value={upcomingEff ?? ""}
                  onChange={(v) =>
                    setValue("upcomingPriceEffectiveAt", v, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                {errors.upcomingPriceEffectiveAt && (
                  <p className="mt-1 text-sm text-danger">{errors.upcomingPriceEffectiveAt.message}</p>
                )}
              </div>
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Start date
            </label>
            <DateInput
              value={startDate}
              onChange={(v) =>
                setValue("startDate", v, { shouldDirty: true, shouldValidate: true })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Next renewal
            </label>
            <DateInput
              value={nextRenewal}
              onChange={(v) =>
                setValue("nextRenewal", v, { shouldDirty: true, shouldValidate: true })
              }
            />
            {errors.nextRenewal && (
              <p className="mt-1 text-sm text-danger">{errors.nextRenewal.message}</p>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Plan ends on (optional)
          </label>
          <DateInput
            value={planEndsAt ?? ""}
            onChange={(v) => setValue("planEndsAt", v, { shouldDirty: true, shouldValidate: true })}
          />
          <p className="mt-1 text-xs text-text-tertiary">
            Leave blank if this subscription has no fixed end date.
          </p>
          {errors.planEndsAt && (
            <p className="mt-1 text-sm text-danger">{errors.planEndsAt.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Notes (optional)
          </label>
          <textarea
            {...register("notes")}
            className="w-full rounded-xl border border-border bg-background-secondary px-4 py-3 text-text-primary placeholder-text-tertiary focus:border-accent focus:outline-none min-h-[100px]"
            placeholder="Optional notes"
          />
        </div>
        <div className="flex gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} className="flex-1">
            Save changes
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
