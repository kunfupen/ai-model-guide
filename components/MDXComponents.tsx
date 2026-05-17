import type { ComponentPropsWithoutRef } from "react";
import { TweetEmbed } from "./TweetEmbed";

export const mdxComponents = {
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2 className="mt-10 text-2xl font-semibold tracking-tight" {...props} />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3 className="mt-8 text-xl font-semibold tracking-tight" {...props} />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p
      className="mt-4 leading-7 text-zinc-700 dark:text-zinc-300"
      {...props}
    />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul className="mt-4 list-disc space-y-2 pl-6 text-zinc-700 dark:text-zinc-300" {...props} />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol className="mt-4 list-decimal space-y-2 pl-6 text-zinc-700 dark:text-zinc-300" {...props} />
  ),
  li: (props: ComponentPropsWithoutRef<"li">) => (
    <li className="leading-7" {...props} />
  ),
  a: (props: ComponentPropsWithoutRef<"a">) => (
    <a
      className="text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400"
      {...props}
    />
  ),
  code: (props: ComponentPropsWithoutRef<"code">) => (
    <code
      className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-sm dark:bg-zinc-800"
      {...props}
    />
  ),
  strong: (props: ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold text-zinc-900 dark:text-zinc-100" {...props} />
  ),
  Tweet: TweetEmbed,
};
