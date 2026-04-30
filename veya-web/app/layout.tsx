import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import { VEYA_ACCENT, VEYA_BG_ROOT, VEYA_SITE_DESCRIPTION } from "@/lib/brand/constants";
import { getSiteUrl } from "@/lib/siteUrl";

const defaultTitle = "Veya — Manage your money";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: defaultTitle,
    template: "%s | Veya",
  },
  description: VEYA_SITE_DESCRIPTION,
  applicationName: "Veya",
  authors: [{ name: "Veya" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Veya",
    title: defaultTitle,
    description: VEYA_SITE_DESCRIPTION,
    url: "/",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Veya — Manage your money",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: VEYA_SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
  // Favicon + apple-touch-icon: `app/icon.tsx` and `app/apple-icon.tsx` (Next injects links).
};

export const viewport: Viewport = {
  themeColor: VEYA_ACCENT,
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark">
      <body className="font-sans bg-background text-text-primary antialiased">
        <script
          // Apply theme ASAP. Light is only used when the user explicitly chose Light in Settings
          // (we persist both veya_accent_preference and veya_theme together). Otherwise default to Veya dark.
          dangerouslySetInnerHTML={{
            __html:
              "(()=>{try{var h=document.documentElement;var a=localStorage.getItem('veya_accent_preference');var t=localStorage.getItem('veya_theme');if(a==='white'&&t==='light'){h.dataset.theme='light';}else{h.dataset.theme='dark';}}catch(e){}})();",
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
