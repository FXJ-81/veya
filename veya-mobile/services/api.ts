import axios from "axios";
import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

const TOKEN_KEY = "veya_access_token";

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function signIn(email: string, password: string) {
  const { data } = await api.post("/api/auth/token", { email, password });
  if (data.accessToken) {
    await SecureStore.setItemAsync(TOKEN_KEY, data.accessToken);
  }
  return data;
}

export async function signOut() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getSubscriptions() {
  const { data } = await api.get("/api/subscriptions");
  return data;
}

export async function getAnalytics() {
  const { data } = await api.get("/api/analytics");
  return data;
}

export async function getFamily() {
  const { data } = await api.get("/api/family");
  return data;
}

export async function sendAIMessage(message: string, history: { role: string; content: string }[]) {
  const { data } = await api.post("/api/ai/chat", { message, history });
  return data;
}

export async function getDailyTip() {
  const { data } = await api.get("/api/ai/daily-tip");
  return data;
}
