"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils";

interface FamilyData {
  family: { id: string; name: string; inviteCode: string; adminId: string } | null;
  members: { id: string; userId: string; name: string | null; email: string; role: string }[];
  totalMonthlySpend: number;
}

export default function FamilyPage() {
  const { status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<FamilyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState("");
  const [createName, setCreateName] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/sign-in");
  }, [status, router]);

  const fetchFamily = async () => {
    const res = await fetch("/api/family");
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  useEffect(() => {
    if (status === "authenticated") fetchFamily();
  }, [status]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode }),
    });
    if (res.ok) fetchFamily();
    setInviteCode("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: createName || undefined }),
    });
    if (res.ok) fetchFamily();
    setCreateName("");
  };

  if (status === "loading" || status === "unauthenticated") {
    return <div className="min-h-screen flex items-center justify-center" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="pl-56 pr-6 py-8">
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-2xl font-bold text-text-primary mb-8"
        >
          Family
        </motion.h1>

        {loading ? (
          <div className="rounded-2xl border border-border bg-card h-48 animate-pulse" />
        ) : data?.family ? (
          <div className="space-y-6">
            <Card glass>
              <h2 className="text-lg font-semibold text-text-primary">
                {data.family.name}
              </h2>
              <p className="text-text-secondary text-sm mt-1">
                Invite code: <span className="font-mono text-accent">{data.family.inviteCode}</span>
              </p>
              <p className="font-mono text-2xl font-bold text-text-primary mt-4 font-mono-nums">
                {formatCurrency(data.totalMonthlySpend)}/mo
              </p>
              <p className="text-xs text-text-tertiary">Total family spend</p>
            </Card>
            <Card>
              <h3 className="font-semibold text-text-primary mb-4">Members</h3>
              <ul className="space-y-2">
                {data.members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3"
                  >
                    <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center font-semibold text-accent">
                      {(m.name ?? m.email).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">
                        {m.name ?? "No name"}
                      </p>
                      <p className="text-xs text-text-secondary">{m.email}</p>
                    </div>
                    <span className="ml-auto">
                      <Badge variant={m.role === "admin" ? "accent" : "default"}>
                        {m.role}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ) : (
          <div className="space-y-6 max-w-md">
            <Card>
              <h3 className="font-semibold text-text-primary mb-2">
                Join a family
              </h3>
              <form onSubmit={handleJoin} className="flex gap-2 mt-3">
                <input
                  type="text"
                  placeholder="Invite code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="flex-1 rounded-xl border border-border bg-background-secondary px-4 py-3 text-text-primary placeholder-text-tertiary focus:border-accent focus:outline-none"
                />
                <Button type="submit">Join</Button>
              </form>
            </Card>
            <Card>
              <h3 className="font-semibold text-text-primary mb-2">
                Create a family
              </h3>
              <form onSubmit={handleCreate} className="flex flex-col gap-2 mt-3">
                <input
                  type="text"
                  placeholder="Family name (optional)"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="rounded-xl border border-border bg-background-secondary px-4 py-3 text-text-primary placeholder-text-tertiary focus:border-accent focus:outline-none"
                />
                <Button type="submit">Create family</Button>
              </form>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
