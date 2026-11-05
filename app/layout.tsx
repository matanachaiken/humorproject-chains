import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getTheme } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Prompt Chains", template: "%s · Prompt Chains" },
  description: "Build and run Daily Riff prompt chains.",
  robots: { index: false, follow: false },
};

// The theme is read from a cookie on the server, so the first paint is right.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme={await getTheme()}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
