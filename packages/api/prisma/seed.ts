import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("password123", 12);
  const user = await prisma.user.upsert({
    where: { email: "demo@veya.app" },
    update: {},
    create: {
      name: "Demo User",
      email: "demo@veya.app",
      passwordHash: hash,
      plan: "PREMIUM",
    },
  });
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  await prisma.subscription.upsert({
    where: { id: "seed-netflix" },
    update: {},
    create: {
      id: "seed-netflix",
      userId: user.id,
      name: "Netflix",
      category: "Streaming",
      price: 15.99,
      billingCycle: "MONTHLY",
      startDate: now,
      nextRenewal: nextMonth,
      status: "ACTIVE",
    },
  });
  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      notificationPrefs: { renewalReminder: 1, weeklySummary: true },
      appearance: { theme: "dark", accentColor: "#5b6ef5" },
    },
  });
  console.log("Seed done. Demo user: demo@veya.app / password123");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
