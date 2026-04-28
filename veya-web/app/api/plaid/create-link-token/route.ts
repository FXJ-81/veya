import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import { getAuthUser } from "@/lib/getAuthUser";
import { getPlaidClient } from "@/lib/plaidServer";

export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const plaid = getPlaidClient();
    const res = await plaid.linkTokenCreate({
      user: { client_user_id: authUser.id },
      client_name: "Veya",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    const link_token = res.data.link_token;
    console.log("[POST /api/plaid/create-link-token] ok for user", authUser.id);
    return NextResponse.json({ link_token });
  } catch (e) {
    console.error("[POST /api/plaid/create-link-token]", e);
    return NextResponse.json({ error: "Failed to create link token" }, { status: 500 });
  }
}
