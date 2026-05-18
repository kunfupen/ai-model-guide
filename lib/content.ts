import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import {
  ModelFrontmatterSchema,
  ToolFrontmatterSchema,
  type ModelFrontmatter,
  type ToolFrontmatter,
} from "./schemas";

const MODELS_DIR = path.join(process.cwd(), "content", "models");
const TOOLS_DIR = path.join(process.cwd(), "content", "tools");

export type Model = {
  frontmatter: ModelFrontmatter;
  body: string;
};

export type Tool = {
  frontmatter: ToolFrontmatter;
  body: string;
};

export async function getAllModelSlugs(): Promise<string[]> {
  const files = await fs.readdir(MODELS_DIR);
  return files
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""))
    .sort();
}

export async function getModelBySlug(slug: string): Promise<Model> {
  const filePath = path.join(MODELS_DIR, `${slug}.mdx`);
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = matter(raw);
  const result = ModelFrontmatterSchema.safeParse(parsed.data);
  if (!result.success) {
    throw new Error(
      `Invalid frontmatter in ${slug}.mdx:\n${result.error.issues
        .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("\n")}`,
    );
  }
  if (result.data.slug !== slug) {
    throw new Error(
      `Slug mismatch in ${slug}.mdx: frontmatter says "${result.data.slug}"`,
    );
  }
  return { frontmatter: result.data, body: parsed.content };
}

export async function getAllModels(): Promise<Model[]> {
  const slugs = await getAllModelSlugs();
  return Promise.all(slugs.map(getModelBySlug));
}

export async function getAllToolSlugs(): Promise<string[]> {
  try {
    const files = await fs.readdir(TOOLS_DIR);
    return files
      .filter((f) => f.endsWith(".mdx"))
      .map((f) => f.replace(/\.mdx$/, ""))
      .sort();
  } catch {
    return [];
  }
}

export async function getToolBySlug(slug: string): Promise<Tool> {
  const filePath = path.join(TOOLS_DIR, `${slug}.mdx`);
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = matter(raw);
  const result = ToolFrontmatterSchema.safeParse(parsed.data);
  if (!result.success) {
    throw new Error(
      `Invalid frontmatter in tools/${slug}.mdx:\n${result.error.issues
        .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("\n")}`,
    );
  }
  if (result.data.slug !== slug) {
    throw new Error(
      `Slug mismatch in tools/${slug}.mdx: frontmatter says "${result.data.slug}"`,
    );
  }
  return { frontmatter: result.data, body: parsed.content };
}

export async function getAllTools(): Promise<Tool[]> {
  const slugs = await getAllToolSlugs();
  return Promise.all(slugs.map(getToolBySlug));
}
