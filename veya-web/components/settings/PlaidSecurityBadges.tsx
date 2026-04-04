import { cn } from "@/lib/utils";

const BADGES = [
  { icon: "🔒", label: "Bank-level encryption" },
  { icon: "👁", label: "Read-only access" },
  { icon: "🛡", label: "Never stores credentials" },
] as const;

export function PlaidSecurityBadges({ className }: { className?: string }) {
  return (
    <div className={cn("w-full min-w-0", className)}>
      <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
        {BADGES.map((b) => (
          <div
            key={b.label}
            className="flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] leading-tight text-text-secondary"
            style={{ backgroundColor: "#1a1a26", borderColor: "#2a2a3a" }}
          >
            <span className="shrink-0 text-sm leading-none" aria-hidden>
              {b.icon}
            </span>
            <span className="min-w-0">{b.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-center text-[11px] leading-snug text-text-tertiary sm:text-left">
        Powered by Plaid · Used by 8,000+ financial apps
      </p>
    </div>
  );
}
