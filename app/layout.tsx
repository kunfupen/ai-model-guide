import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "AI Model Guide",
  description:
    "A curated catalog of popular AI models — specs, availability, and distilled usage guidance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <header className="sticky top-0 z-10 border-b border-zinc-200/70 bg-white/80 backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/80">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link
              href="/"
              className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
            >
              AI Model Guide
            </Link>
            <nav className="flex items-center gap-6 text-sm text-zinc-500 dark:text-zinc-400">
              <a
                href="https://github.com/kunfupen/ai-model-guide"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                GitHub
              </a>
            </nav>
          </div>
        </header>
        {children}
        <footer className="mt-24 border-t border-zinc-200/70 dark:border-zinc-800/70">
          <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-zinc-500 dark:text-zinc-500">
            Curated by hand. Content reflects publicly available information from
            each provider.
          </div>
        </footer>
      </body>
    </html>
  );
}
