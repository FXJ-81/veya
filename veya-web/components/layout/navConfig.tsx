import type { LucideIcon } from "lucide-react";
import { AppIcons } from "@/lib/icons";

export const MAIN_NAV: readonly { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", Icon: AppIcons.navDashboard },
  { href: "/subscriptions", label: "Subscriptions", Icon: AppIcons.navSubscriptions },
  { href: "/analytics", label: "Analytics", Icon: AppIcons.navAnalytics },
  { href: "/coach", label: "AI Coach", Icon: AppIcons.navCoach },
  { href: "/settings", label: "Settings", Icon: AppIcons.navSettings },
];
