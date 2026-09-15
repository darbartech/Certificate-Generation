import type { Metadata } from "next";
import "./globals.css";
import { seedDatabase } from "@/lib/database";

seedDatabase().catch(console.error);

export const metadata: Metadata = {
  title: "DarbarTech Certificate System",
  description: "Programmable certificate generation and verification system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
