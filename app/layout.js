import { Inter, Tajawal } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import AuthGuard from "@/components/layout/AuthGuard";
import { UserProvider } from "@/contexts/UserContext";
import { AppActionsProvider } from "@/contexts/AppActionsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LocaleProvider } from "@/contexts/LocaleContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
});

export const metadata = {
  title: "Flowin - Financial Dashboard",
  description: "Modern financial tracking and management dashboard",

  // ✅ PWA / Manifest config
  manifest: "/site.webmanifest",

  // (اختياري لكن احترافي)
  icons: {
    icon: [
      { url: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/web-app-manifest-192x192.png",
  },
}

export const viewport = {
  themeColor: "#ffffff",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr" className={`${inter.variable} ${tajawal.variable}`}>
      <body>
        <UserProvider>
          <ThemeProvider>
            <LocaleProvider>
              <AppActionsProvider>
                <AuthGuard>
                  <AppShell>{children}</AppShell>
                </AuthGuard>
              </AppActionsProvider>
            </LocaleProvider>
          </ThemeProvider>
        </UserProvider>
      </body>
    </html>
  );
}