import type { ReactNode } from "react";
import { AppIcons } from "@/lib/icons";

/** Map stored notification `type` (possibly prefixed) to a professional icon. */
export function notificationIconForType(type: string): ReactNode {
  if (type === "welcome") return <AppIcons.notificationWelcome className="h-4 w-4" aria-hidden />;
  if (type.startsWith("renewal_reminder:") || type.startsWith("renewal:")) {
    return <AppIcons.notificationRenewal className="h-4 w-4" aria-hidden />;
  }
  if (type.startsWith("budget:")) return <AppIcons.notificationBudget className="h-4 w-4" aria-hidden />;
  if (type.startsWith("new_subscription:")) {
    return <AppIcons.notificationNewSubscription className="h-4 w-4" aria-hidden />;
  }
  if (type.startsWith("weekly:") || type.startsWith("monthly:")) {
    return <AppIcons.notificationSummary className="h-4 w-4" aria-hidden />;
  }
  if (type.startsWith("price_increase:")) return <AppIcons.notificationWarning className="h-4 w-4" aria-hidden />;
  return <AppIcons.notificationWarning className="h-4 w-4" aria-hidden />;
}
