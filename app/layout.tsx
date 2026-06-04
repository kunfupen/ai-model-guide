import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { CommandPalette, type CommandItem } from "@/components/CommandPalette";
import { getAllModels, getAllTools } from "@/lib/content";
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
  metadataBase: new URL("https://ai-model-guide.vercel.app"),
  title: {
    default: "AI Model Guide — Compare Claude, GPT, Gemini & more",
    template: "%s — AI Model Guide",
  },
  description:
    "A curated catalog of popular AI models — specs, availability, benchmarks, and distilled usage guidance, written for the developers who actually have to pick one.",
  openGraph: {
    title: "AI Model Guide",
    description:
      "Specs, availability, benchmarks, and distilled guidance for the models from OpenAI, Anthropic, Google, and more.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [models, tools] = await Promise.all([getAllModels(), getAllTools()]);
  const commandItems: CommandItem[] = [
    ...models.map(({ frontmatter: f }) => ({
      label: f.name,
      href: `/models/${f.slug}`,
      group: "Models" as const,
      hint: f.provider,
      keywords: f.strengths.join(" "),
    })),
    ...tools.map(({ frontmatter: f }) => ({
      label: f.name,
      href: `/tools/${f.slug}`,
      group: "Tools" as const,
      hint: f.category,
      keywords: f.strengths.join(" "),
    })),
    { label: "Models catalog", href: "/", group: "Pages" as const },
    { label: "Benchmarks", href: "/benchmarks", group: "Pages" as const },
    { label: "Tools", href: "/tools", group: "Pages" as const },
  ];

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Set the theme before first paint to avoid a flash of the wrong theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <CommandPalette items={commandItems} />
        <SiteHeader />
        {children}
        <footer className="mt-28 border-t border-zinc-200/70 dark:border-zinc-800/70">
          <div className="mx-auto max-w-5xl px-6 py-12">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-sm">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="grid h-7 w-7 place-items-center rounded-lg bg-zinc-900 text-[13px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    AI
                  </span>
                  <span className="text-sm font-semibold tracking-tight">
                    Model Guide
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  A curated, developer-first catalog of AI models — specs,
                  benchmarks, and honest guidance. Content reflects publicly
                  available information from each provider.
                </p>
              </div>
              <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
                <span className="col-span-2 text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
                  Explore
                </span>
                <Link href="/" className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                  Models
                </Link>
                <Link href="/benchmarks" className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                  Benchmarks
                </Link>
                <Link href="/tools" className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                  Tools
                </Link>
                <a
                  href="https://github.com/kunfupen/ai-model-guide"
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  GitHub
                </a>
              </nav>
            </div>
            <div className="mt-10 border-t border-zinc-200/70 pt-6 text-xs text-zinc-400 dark:border-zinc-800/70 dark:text-zinc-600">
              © {new Date().getFullYear()} AI Model Guide · Built with Next.js.
              Curated by hand.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
