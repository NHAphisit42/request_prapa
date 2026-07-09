import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";

// Prompt = brand Thai/bilingual typeface per HEA Brand Guidelines v1.0
const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-prompt",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ขอใช้น้ำประปา | HEA Water Solutions",
  description:
    "ระบบขอใช้น้ำประปาออนไลน์ — Hydro Enterprise and Aqua Design Co., Ltd.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={prompt.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
