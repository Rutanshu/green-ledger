import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "./AppShell";
import { getDemoOrg } from "@/lib/demo-org";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Green Ledger",
  description: "Emissions accounting, traced back to source.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const org = await getDemoOrg();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppShell orgName={org?.legalName ?? "Green Ledger"}>{children}</AppShell>
      </body>
    </html>
  );
}
