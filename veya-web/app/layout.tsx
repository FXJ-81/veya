import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Veya — Manage your money",
  description:
    "Track spending and subscriptions, spot savings, and get AI-powered financial coaching.",
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
