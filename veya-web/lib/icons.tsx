import type { ComponentProps } from "react";
import {
  Bell,
  BotMessageSquare,
  ChartLine,
  CheckCircle2,
  CreditCard,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Search,
  Settings,
  TriangleAlert,
  Wallet,
} from "lucide-react";

export type AppIconProps = ComponentProps<"svg"> & { className?: string };

export const AppIcons = {
  // Navigation
  navDashboard: LayoutDashboard,
  navSubscriptions: ListChecks,
  navAnalytics: ChartLine,
  navCoach: BotMessageSquare,
  navSettings: Settings,

  // UI bits
  bell: Bell,
  tip: Lightbulb,
  success: CheckCircle2,
  search: Search,

  // Notification types
  notificationWelcome: LayoutDashboard,
  notificationRenewal: Bell,
  notificationBudget: Wallet,
  notificationNewSubscription: CreditCard,
  notificationSummary: ChartLine,
  notificationWarning: TriangleAlert,
} as const;

