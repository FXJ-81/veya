import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma/client.js";

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS ?? "12", 10);
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-min-32-characters-long";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-min-32-characters-long";
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN ?? "30d";

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES } as jwt.SignOptions);
}

export function signRefreshToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): { userId: string; email: string } {
  const decoded = jwt.verify(token, ACCESS_SECRET) as { userId: string; email: string };
  return decoded;
}

export function verifyRefreshToken(token: string): { userId: string; email: string } {
  const decoded = jwt.verify(token, REFRESH_SECRET) as { userId: string; email: string };
  return decoded;
}

export async function register(input: RegisterInput): Promise<{ user: { id: string; name: string; email: string }; tokens: TokenPair }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new Error("Email already registered");
  }
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
    },
  });
  const accessToken = signAccessToken(user.id, user.email);
  const refreshToken = signRefreshToken(user.id, user.email);
  const expiresIn = 15 * 60;
  return {
    user: { id: user.id, name: user.name, email: user.email },
    tokens: { accessToken, refreshToken, expiresIn },
  };
}

export async function login(input: LoginInput): Promise<{ user: { id: string; name: string; email: string }; tokens: TokenPair }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new Error("Invalid email or password");
  }
  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new Error("Invalid email or password");
  }
  const accessToken = signAccessToken(user.id, user.email);
  const refreshToken = signRefreshToken(user.id, user.email);
  const expiresIn = 15 * 60;
  return {
    user: { id: user.id, name: user.name, email: user.email },
    tokens: { accessToken, refreshToken, expiresIn },
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, avatar: true, plan: true, createdAt: true },
  });
  if (!user) throw new Error("User not found");
  return user;
}
