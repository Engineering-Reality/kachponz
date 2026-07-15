import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Poppins, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

// Friendlier, corporate-suite UI font for labels, body chrome, and controls
const poppins = Poppins({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Display font for headlines and section heads — distinct from body Inter
const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Amadeus — Enterprise Agentic Orchestrator",
  description: "Secure multi-agent orchestration for Trade Finance settlement.",
  icons: {
    icon: "/amadeus.svg",
    apple: "/amadeus.svg",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${poppins.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-white text-slate-900">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
