import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "GoPinion Outbound OS",
    template: "%s | GoPinion Outbound OS",
  },
  description:
    "A modular outbound operating system for dealer-first lead intake, enrichment, outreach, booking, and learning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
