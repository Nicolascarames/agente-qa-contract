import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { EnvironmentSchema, type Environment } from "./common.js";
import type { ParseIssue } from "./index.js";

export const PROJECT_DIR = ".agente-qa";

export function projectPaths(rootDir: string): {
  root: string;
  dir: string;
  configPath: string;
  envPath: string;
  mapDir: string;
  mapPath: string;
  featuresDir: string;
  stateDir: string;
  memoryPath: string;
} {
  const dir = path.join(rootDir, PROJECT_DIR);
  const mapDir = path.join(dir, "map");
  return {
    root: rootDir,
    dir,
    configPath: path.join(dir, "config.json"),
    envPath: path.join(dir, ".env"),
    mapDir,
    mapPath: path.join(mapDir, "map.json"),
    featuresDir: path.join(dir, "features"),
    stateDir: path.join(dir, "state"),
    memoryPath: path.join(dir, "memory.json"),
  };
}

export const GITIGNORE_LINES = [".agente-qa/.env", ".agente-qa/state/", "playwright-report/", "test-results/"];

export const ProjectConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    appUrl: z.string().url(),
    environment: EnvironmentSchema,
    limits: z
      .object({
        maxIterations: z.number().int().min(1).default(40),
        maxScreens: z.number().int().min(1).default(25),
        maxCostUsd: z.number().positive().default(2),
      })
      .default({ maxIterations: 40, maxScreens: 25, maxCostUsd: 2 }),
  })
  .strict();

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

export type ParseProjectConfigResult = { ok: true; config: ProjectConfig } | { ok: false; issues: ParseIssue[] };

/** Nunca lanza: traduce el resultado de Zod a un objeto plano, fácil de loguear o mostrar. */
export function parseProjectConfig(input: unknown): ParseProjectConfigResult {
  const result = ProjectConfigSchema.safeParse(input);
  if (result.success) {
    return { ok: true, config: result.data };
  }

  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

export async function ensureProject(
  rootDir: string,
  opts: { appUrl: string; environment: Environment; limits?: Partial<ProjectConfig["limits"]> }
): Promise<{ created: string[]; kept: string[]; gitignore: "created" | "appended" | "already-complete" }> {
  const paths = projectPaths(rootDir);
  const created: string[] = [];
  const kept: string[] = [];

  for (const dir of [paths.dir, paths.mapDir, paths.featuresDir, paths.stateDir]) {
    if (await pathExists(dir)) {
      kept.push(dir);
    } else {
      await mkdir(dir, { recursive: true });
      created.push(dir);
    }
  }

  if (await pathExists(paths.configPath)) {
    kept.push(paths.configPath);
  } else {
    const config: ProjectConfig = {
      schemaVersion: 1,
      appUrl: opts.appUrl,
      environment: opts.environment,
      limits: {
        maxIterations: opts.limits?.maxIterations ?? 40,
        maxScreens: opts.limits?.maxScreens ?? 25,
        maxCostUsd: opts.limits?.maxCostUsd ?? 2,
      },
    };
    await writeFile(paths.configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
    created.push(paths.configPath);
  }

  if (await pathExists(paths.envPath)) {
    kept.push(paths.envPath);
  } else {
    await writeFile(paths.envPath, "", "utf8");
    created.push(paths.envPath);
  }

  if (await pathExists(paths.memoryPath)) {
    kept.push(paths.memoryPath);
  } else {
    await writeFile(paths.memoryPath, "{}\n", "utf8");
    created.push(paths.memoryPath);
  }

  const gitignorePath = path.join(rootDir, ".gitignore");
  const gitignore = await ensureGitignore(gitignorePath);

  return { created, kept, gitignore };
}

async function ensureGitignore(gitignorePath: string): Promise<"created" | "appended" | "already-complete"> {
  if (!(await pathExists(gitignorePath))) {
    await writeFile(gitignorePath, GITIGNORE_LINES.join("\n") + "\n", "utf8");
    return "created";
  }

  const existing = await readFile(gitignorePath, "utf8");
  const existingLines = new Set(
    existing
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  );
  const missing = GITIGNORE_LINES.filter((line) => !existingLines.has(line));
  if (missing.length === 0) {
    return "already-complete";
  }

  const separator = existing.endsWith("\n") ? "" : "\n";
  await writeFile(gitignorePath, existing + separator + missing.join("\n") + "\n", "utf8");
  return "appended";
}
