import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { ACCENT_PREFERENCE_VALUES, type AccentPreference } from "@/lib/accentPreference";
import { readAccentPreferenceFromDb, writeAccentPreferenceToDb } from "@/lib/userSettingsAccentSql";

async function ensureSettings(userId: string) {
  return prisma.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureSettings(authUser.id);

  try {
    const fromDb = await readAccentPreferenceFromDb(prisma, authUser.id);
    const accentPreference = fromDb ?? "brand";
    return NextResponse.json({ accentPreference });
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code?: unknown }).code) : "";
    const isMissingColumn =
      code === "42703" ||
      (e instanceof Error &&
        (/column .*accentPreference|accentPreference.*does not exist/i.test(e.message) ||
          /no such column/i.test(e.message)));
    if (isMissingColumn) {
      return NextResponse.json(
        {
          error: "Database is missing accentPreference column. Run: npx prisma migrate deploy (or db push) from veya-web.",
        },
        { status: 503 },
      );
    }
    console.error("[settings/appearance GET]", e);
    return NextResponse.json({ error: "Could not load appearance settings" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const nextRaw = (body as Record<string, unknown>).accentPreference;
  if (typeof nextRaw !== "string" || !ACCENT_PREFERENCE_VALUES.includes(nextRaw as AccentPreference)) {
    return NextResponse.json({ error: "accentPreference must be 'brand' or 'white'" }, { status: 400 });
  }

  const accentPreference = nextRaw as AccentPreference;

  await ensureSettings(authUser.id);

  try {
    const updated = await writeAccentPreferenceToDb(prisma, authUser.id, accentPreference);
    if (updated === 0) {
      return NextResponse.json({ error: "User settings row not found" }, { status: 404 });
    }
    return NextResponse.json({ accentPreference });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isMissingColumn =
      /column .*accentPreference|accentPreference.*does not exist/i.test(msg) || /no such column/i.test(msg);
    if (isMissingColumn) {
      return NextResponse.json(
        {
          error: "Database is missing accentPreference column. Run: npx prisma migrate deploy (or db push) from veya-web.",
        },
        { status: 503 },
      );
    }
    console.error("[settings/appearance PATCH]", e);
    return NextResponse.json({ error: "Could not save appearance settings" }, { status: 500 });
  }
}
