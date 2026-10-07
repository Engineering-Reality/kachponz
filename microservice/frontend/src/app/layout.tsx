import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Poppins, Unbounded } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { ThemeProvider } from "@/components/ThemeProvider";
import { HoloRuntime } from "@/components/HoloRuntime";

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

// Display font — wide, geometric, echoes the squared AMADEUS wordmark in the logo
const unbounded = Unbounded({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const viewport: Viewport = {
  themeColor: "#050505",
  viewportFit: "cover",
};

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
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} ${poppins.variable} ${unbounded.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <HoloRuntime />
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
