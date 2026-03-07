import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { verifyToken } from "./jwt";
import { prisma } from "./prisma";

export async function getAuthUser(request: Request): Promise<{
  id: string;
  email: string;
  name: string | null;
} | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (user) return { id: user.id, email: user.email, name: user.name };
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = await verifyToken(token);
    if (payload) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });
      if (user) return { id: user.id, email: user.email, name: user.name };
    }
  }
  return null;
}
