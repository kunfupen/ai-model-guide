# AI Model Guide

A curated catalog of popular AI models — specs, availability, and distilled
guidance from the people who build them. Built so developers can compare GPT,
Claude, Gemini, and Llama variants in one place instead of hunting across four
provider sites and X.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) — SSG for the catalog and every model page
- [Tailwind CSS v4](https://tailwindcss.com)
- [next-mdx-remote](https://github.com/hashicorp/next-mdx-remote) — content lives in
  `content/models/*.mdx`, rendered server-side
- [Zod](https://zod.dev) — validates model frontmatter at build time; bad data
  fails the build
- [react-tweet](https://react-tweet.vercel.app) — static tweet embeds, no X API

## Local development

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

## Authoring a new model

1. Create a new file in `content/models/`, named `<provider>-<model-slug>.mdx`
   (e.g. `openai-gpt-5.mdx`).
2. Fill in the frontmatter. The single source of truth is
   [`lib/schemas.ts`](lib/schemas.ts):

   ```yaml
   ---
   slug: openai-gpt-5            # must match the filename
   name: GPT-5
   provider: openai              # openai | anthropic | google | meta
   releaseDate: 2026-04-10
   contextWindow: 1000000
   modalities: [text, vision]    # text | vision | audio | video
   pricing:
     inputPer1M: 5
     outputPer1M: 20
   availability: [api, chatgpt]  # see schemas.ts for full list
   strengths: [coding, reasoning]
   officialDocs: https://platform.openai.com/docs/models/gpt-5
   tweetIds: ["1234567890"]      # numeric IDs from x.com URLs
   ---
   ```

3. Write the body as MDX — H2/H3 headings, lists, code blocks, and
   `<Tweet id="..." />` embeds all work. See
   [`content/models/anthropic-claude-4-7-opus.mdx`](content/models/anthropic-claude-4-7-opus.mdx)
   as a template.
4. `pnpm build` will fail loudly if the frontmatter is malformed — that's the
   guardrail.

## Deploy

Pushes to `main` deploy automatically via Vercel.

## Project layout

```
app/
  page.tsx                  homepage / catalog
  models/[slug]/page.tsx    per-model detail (SSG)
components/
  SpecsTable.tsx            dense spec dl
  TweetEmbed.tsx            react-tweet wrapper
  MDXComponents.tsx         MDX → JSX mappings
lib/
  schemas.ts                Zod schema (single source of truth)
  content.ts                content loader
content/models/*.mdx        the catalog
```

## License

MIT
