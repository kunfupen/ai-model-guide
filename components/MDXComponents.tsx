import type { ComponentPropsWithoutRef } from "react";
import { TweetEmbed } from "./TweetEmbed";

export const mdxComponents = {
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2
      className="mt-16 border-b border-zinc-200 pb-3 text-2xl font-semibold tracking-tight text-zinc-900 dark:border-zinc-800 dark:text-zinc-50"
      {...props}
    />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3
      className="mt-10 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
      {...props}
    />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p
      className="mt-5 text-[17px] leading-8 text-zinc-700 dark:text-zinc-300"
      {...props}
    />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul
      className="mt-5 list-disc space-y-2 pl-6 text-[17px] leading-8 text-zinc-700 marker:text-zinc-400 dark:text-zinc-300 dark:marker:text-zinc-600"
      {...props}
    />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol
      className="mt-5 list-decimal space-y-2 pl-6 text-[17px] leading-8 text-zinc-700 marker:text-zinc-400 dark:text-zinc-300 dark:marker:text-zinc-600"
      {...props}
    />
  ),
  li: (props: ComponentPropsWithoutRef<"li">) => (
    <li className="leading-8" {...props} />
  ),
  a: (props: ComponentPropsWithoutRef<"a">) => (
    <a
      className="text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
      {...props}
    />
  ),
  code: (props: ComponentPropsWithoutRef<"code">) => (
    <code
      className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.875em] text-zinc-900 dark:bg-zinc-800/80 dark:text-zinc-100"
      {...props}
    />
  ),
  pre: (props: ComponentPropsWithoutRef<"pre">) => (
    <pre
      className="mt-5 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 dark:border-zinc-800 dark:bg-zinc-900"
      {...props}
    />
  ),
  blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className="mt-5 border-l-2 border-zinc-300 pl-5 text-[17px] italic leading-8 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
      {...props}
    />
  ),
  strong: (props: ComponentPropsWithoutRef<"strong">) => (
    <strong
      className="font-semibold text-zinc-900 dark:text-zinc-50"
      {...props}
    />
  ),
  hr: () => (
    <hr className="my-12 border-zinc-200 dark:border-zinc-800" />
  ),
  Tweet: TweetEmbed,
};
