import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureProject, GITIGNORE_LINES, LoginRecipeSchema, parseProjectConfig, projectPaths } from "../src/project.js";

describe("parseProjectConfig", () => {
  it("acepta una config válida y aplica los defaults de limits", () => {
    const result = parseProjectConfig({
      schemaVersion: 1,
      appUrl: "https://example.com",
      environment: "dev",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("se esperaba ok: true");
    }
    expect(result.config.limits).toEqual({ maxIterations: 40, maxScreens: 25, maxCostUsd: 2 });
  });

  it("rechaza una config con environment inválido", () => {
    const result = parseProjectConfig({
      schemaVersion: 1,
      appUrl: "https://example.com",
      environment: "canary",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("se esperaba ok: false");
    }
    expect(result.issues[0]?.path).toBe("environment");
  });

  it("sigue aceptando una config sin loginRecipe (retrocompatibilidad)", () => {
    const result = parseProjectConfig({
      schemaVersion: 1,
      appUrl: "https://example.com",
      environment: "dev",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("se esperaba ok: true");
    }
    expect(result.config.loginRecipe).toBeUndefined();
  });

  it("sigue aceptando una config sin testIdAttribute (retrocompatibilidad)", () => {
    const result = parseProjectConfig({
      schemaVersion: 1,
      appUrl: "https://example.com",
      environment: "dev",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("se esperaba ok: true");
    }
    expect(result.config.testIdAttribute).toBeUndefined();
  });

  it("acepta una config con testIdAttribute válido", () => {
    const result = parseProjectConfig({
      schemaVersion: 1,
      appUrl: "https://example.com",
      environment: "dev",
      testIdAttribute: "data-qa",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("se esperaba ok: true");
    }
    expect(result.config.testIdAttribute).toBe("data-qa");
  });

  it("acepta una config con loginRecipe válida", () => {
    const result = parseProjectConfig({
      schemaVersion: 1,
      appUrl: "https://example.com",
      environment: "dev",
      loginRecipe: {
        url: "https://example.com/login",
        usernameLocator: "#username",
        passwordLocator: "#password",
        submitLocator: "button[type=submit]",
        successCheck: { kind: "url", value: "/dashboard" },
      },
    });
    expect(result.ok).toBe(true);
  });
});

describe("LoginRecipeSchema", () => {
  const validRecipe = {
    url: "https://example.com/login",
    usernameLocator: "#username",
    passwordLocator: "#password",
    submitLocator: "button[type=submit]",
    successCheck: { kind: "url", value: "/dashboard" },
  };

  it("acepta una receta válida", () => {
    expect(LoginRecipeSchema.safeParse(validRecipe).success).toBe(true);
  });

  it("rechaza una receta con un campo obligatorio ausente", () => {
    const withoutPassword = {
      url: validRecipe.url,
      usernameLocator: validRecipe.usernameLocator,
      submitLocator: validRecipe.submitLocator,
      successCheck: validRecipe.successCheck,
    };
    expect(LoginRecipeSchema.safeParse(withoutPassword).success).toBe(false);
  });

  it("rechaza campos extra por el .strict()", () => {
    const result = LoginRecipeSchema.safeParse({ ...validRecipe, password: "secret_sauce" });
    expect(result.success).toBe(false);
  });

  it("rechaza un successCheck.kind fuera de 'url' | 'text'", () => {
    const result = LoginRecipeSchema.safeParse({
      ...validRecipe,
      successCheck: { kind: "cookie", value: "session" },
    });
    expect(result.success).toBe(false);
  });
});

describe("projectPaths", () => {
  it("incluye capturasDir bajo .agente-qa/capturas", () => {
    const rootDir = path.join(tmpdir(), "agente-qa-contract-paths-fixture");
    const paths = projectPaths(rootDir);
    expect(paths.capturasDir).toBe(path.join(rootDir, ".agente-qa", "capturas"));
  });
});

describe("GITIGNORE_LINES", () => {
  it("incluye .agente-qa/capturas/", () => {
    expect(GITIGNORE_LINES).toContain(".agente-qa/capturas/");
  });
});

describe("ensureProject", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), "agente-qa-contract-"));
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it("crea todo lo que falta en una carpeta vacía", async () => {
    const result = await ensureProject(rootDir, { appUrl: "https://example.com", environment: "dev" });
    const paths = projectPaths(rootDir);

    expect(result.kept).toEqual([]);
    expect(result.created).toEqual(
      expect.arrayContaining([paths.dir, paths.mapDir, paths.featuresDir, paths.stateDir, paths.configPath, paths.envPath, paths.memoryPath])
    );
    expect(result.gitignore).toBe("created");

    const config = JSON.parse(await readFile(paths.configPath, "utf8")) as unknown;
    expect(parseProjectConfig(config).ok).toBe(true);

    const gitignore = await readFile(path.join(rootDir, ".gitignore"), "utf8");
    expect(gitignore).toContain(".agente-qa/.env");
    expect(gitignore).toContain(".agente-qa/state/");
    expect(gitignore).toContain(".agente-qa/capturas/");
    expect(gitignore).toContain("playwright-report/");
    expect(gitignore).toContain("test-results/");
  });

  it("relanzarlo es idempotente: la segunda llamada no crea nada nuevo", async () => {
    await ensureProject(rootDir, { appUrl: "https://example.com", environment: "dev" });
    const second = await ensureProject(rootDir, { appUrl: "https://example.com", environment: "dev" });

    expect(second.created).toEqual([]);
    expect(second.gitignore).toBe("already-complete");

    const paths = projectPaths(rootDir);
    expect(second.kept).toEqual(
      expect.arrayContaining([paths.dir, paths.mapDir, paths.featuresDir, paths.stateDir, paths.configPath, paths.envPath, paths.memoryPath])
    );
  });

  it("no toca un config.json ya existente", async () => {
    const paths = projectPaths(rootDir);
    await mkdir(paths.dir, { recursive: true });
    const handWritten = JSON.stringify({ schemaVersion: 1, appUrl: "https://otra-app.com", environment: "production" });
    await writeFile(paths.configPath, handWritten, "utf8");

    await ensureProject(rootDir, { appUrl: "https://example.com", environment: "dev" });

    const onDisk = await readFile(paths.configPath, "utf8");
    expect(onDisk).toBe(handWritten);
  });

  it("añade solo las líneas que faltan a un .gitignore que ya tiene algunas", async () => {
    const gitignorePath = path.join(rootDir, ".gitignore");
    await writeFile(gitignorePath, ".agente-qa/.env\nplaywright-report/\n", "utf8");

    const result = await ensureProject(rootDir, { appUrl: "https://example.com", environment: "dev" });

    expect(result.gitignore).toBe("appended");
    const content = await readFile(gitignorePath, "utf8");
    const lines = content.split(/\r?\n/).filter((line) => line.length > 0);
    expect(lines).toEqual(
      expect.arrayContaining([
        ".agente-qa/.env",
        ".agente-qa/state/",
        ".agente-qa/capturas/",
        "playwright-report/",
        "test-results/",
      ])
    );
    expect(new Set(lines).size).toBe(lines.length);
  });
});
