import type { Metadata } from "next";
import { Open_Sans, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { getCurrentUser } from "@/lib/auth/session";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
});

const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SITE PULSE — Hutton Development Operations",
  description:
    "Real-time pulse on every commercial development project, from site selection to closeout.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Auth is optional until SESSION_SECRET is set. With auth on, the login page
  // renders bare (no user) — everything else only renders for a signed-in user.
  const authEnabled = !!process.env.SESSION_SECRET;
  const user = await getCurrentUser();
  const showShell = !authEnabled || !!user;

  return (
    <html
      lang="en"
      className={`${openSans.variable} ${barlow.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 font-sans text-slate-900">
        {showShell ? (
          <div className="flex min-h-screen">
            <Sidebar
              user={user && { name: user.name, email: user.email, role: user.role }}
            />
            <main className="flex-1 overflow-x-hidden">{children}</main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
