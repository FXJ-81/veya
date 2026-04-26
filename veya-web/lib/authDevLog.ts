/**
 * OAuth / NextAuth adapter trace logs — development only.
 * Avoids shipping emails, provider ids, and linkage details to production logs.
 */
export function authDevLog(...args: unknown[]): void {
  if (process.env.NODE_ENV === "development") {
    console.log(...args);
  }
}
