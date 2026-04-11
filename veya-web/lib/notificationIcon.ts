/** Map stored notification `type` (possibly prefixed) to header icon. */
export function notificationIconForType(type: string): string {
  if (type === "welcome") return "👋";
  if (type.startsWith("renewal:")) return "🔔";
  if (type.startsWith("budget:")) return "💰";
  if (type.startsWith("new_subscription:")) return "✅";
  if (type.startsWith("weekly:")) return "📊";
  if (type.startsWith("price_increase:")) return "⚠️";
  return "⚠️";
}
