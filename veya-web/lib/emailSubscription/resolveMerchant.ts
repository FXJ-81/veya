/**
 * Map sender apex domain + subject/body text → display name + category for known merchants.
 * Body is included so subjects like "Your receipt from Apple" still match iCloud/Apple One in body.
 */

export function resolveServiceNameAndCategory(
  root: string,
  subject: string,
  bodyLower: string
): { name: string; category: string } | null {
  const s = `${subject}\n${bodyLower}`.toLowerCase();

  switch (root) {
    case "apple.com":
      if (s.includes("apple one")) return { name: "Apple One", category: "Productivity" };
      if (s.includes("icloud") || s.includes("icloud+")) return { name: "iCloud+", category: "Storage" };
      if (s.includes("apple music")) return { name: "Apple Music", category: "Music" };
      if (s.includes("apple tv")) return { name: "Apple TV+", category: "Streaming" };
      return null;
    case "openai.com":
      return { name: "ChatGPT Plus", category: "AI" };
    case "anthropic.com":
    case "claude.ai":
      return { name: "Claude Pro", category: "AI" }; // claude.ai receipts
    case "netflix.com":
      return { name: "Netflix", category: "Streaming" };
    case "spotify.com":
      return { name: "Spotify", category: "Music" };
    case "google.com":
      if (s.includes("youtube premium") || s.includes("youtube music")) {
        return { name: "YouTube Premium", category: "Streaming" };
      }
      if (s.includes("google one")) return { name: "Google One", category: "Storage" };
      if (s.includes("google play") && (s.includes("pass") || s.includes("subscription"))) {
        return { name: "Google Play Pass", category: "Entertainment" };
      }
      return null;
    case "amazon.com":
      return { name: "Amazon Prime", category: "Shopping" };
    case "hulu.com":
      return { name: "Hulu", category: "Streaming" };
    case "disneyplus.com":
      return { name: "Disney+", category: "Streaming" };
    case "microsoft.com":
      return { name: "Microsoft 365", category: "Productivity" };
    case "adobe.com":
      return { name: "Adobe Creative Cloud", category: "Productivity" };
    case "dropbox.com":
      return { name: "Dropbox", category: "Storage" };
    case "github.com":
      return { name: "GitHub Pro", category: "Productivity" };
    case "notion.so":
      return { name: "Notion", category: "Productivity" };
    case "linkedin.com":
      return { name: "LinkedIn Premium", category: "Productivity" };
    case "duolingo.com":
      return { name: "Duolingo", category: "Education" };
    case "nytimes.com":
      return { name: "NYT", category: "News" };
    default:
      return null;
  }
}
