import type { Metadata } from "next";
import { Poppins, Caveat } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "devanagari"],
  variable: "--font-poppins",
});

const caveat = Caveat({
  weight: ["400", "700"],
  subsets: ["latin", "cyrillic"], // Caveat doesn't have devanagari natively but falls back to system or we can load it if available. Wait, Google Fonts Caveat doesn't list Devanagari. If Devanagari is needed, "Handlee" or just let Poppins handle Devanagari fallback while English is Caveat. Let's just use Caveat as requested by user.
  variable: "--font-caveat",
});

export const metadata: Metadata = {
  title: "EngineerOS",
  description: "The Multimodal AI Workspace for Engineers",
};

import { ThemeProvider } from "@/components/theme-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${poppins.variable} ${caveat.variable} ${poppins.className} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
