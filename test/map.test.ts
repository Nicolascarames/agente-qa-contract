import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CoverageEntrySchema, LocatorEntrySchema, parseAppMap } from "../src/index.js";

const fixturesDir = new URL("../fixtures/", import.meta.url);

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(name, fixturesDir), "utf8"));
}

describe("parseAppMap", () => {
  it("acepta un map.json válido", () => {
    const result = parseAppMap(loadFixture("map-valido.json"));
    expect(result.ok).toBe(true);
  });

  it("acepta un map.json válido con states, ambiguous, transitions y writeActions poblados", () => {
    const result = parseAppMap(loadFixture("map-valido-campos-nuevos.json"));
    expect(result.ok).toBe(true);
  });

  it.each([
    ["roto-schema-version.json", "schemaVersion"],
    ["roto-campo-desconocido.json", "screens[0]"],
    ["roto-count.json", "screens[0].locators[0].count"],
    ["roto-agent.json", "screens[0].producedBy.agent"],
    ["roto-reached-by.json", "screens[0].reachedBy"],
    ["roto-probe-en-texts.json", "screens[0].probeValues[0]"],
    ["roto-falta-campo.json", "screens[0].signature"],
    ["roto-estado-kind.json", "screens[0].states[0].kind"],
    ["roto-ambiguous-count.json", "screens[0].ambiguous[0].count"],
    ["roto-transition-sin-locator.json", "screens[0].transitions[0].locatorName"],
    ["roto-write-action-environment.json", "screens[0].writeActions[0].environments[0]"],
  ])("rechaza %s con path %s", (fixture, expectedPath) => {
    const result = parseAppMap(loadFixture(fixture));
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("se esperaba ok: false");
    }
    expect(result.issues[0]?.path).toBe(expectedPath);
  });
});

describe("LocatorEntrySchema", () => {
  const baseLocator = {
    name: "botón enviar",
    kind: "button" as const,
    ts: "getByRole('button', { name: 'Enviar' }).nth(1)",
    count: 1 as const,
    producedBy: {
      agent: "mapeador-mcp" as const,
      version: "0.1.0",
      at: "2026-09-02T10:00:00.000Z",
    },
    verifiedAt: "2026-09-02T10:00:00.000Z",
  };

  it("acepta un locator con fragile y su motivo", () => {
    const result = LocatorEntrySchema.safeParse({
      ...baseLocator,
      fragile: { reason: "selector posicional .nth(1), no hay atributo estable que lo distinga" },
    });
    expect(result.success).toBe(true);
  });

  it("acepta un locator sin fragile (campo opcional)", () => {
    const result = LocatorEntrySchema.safeParse(baseLocator);
    expect(result.success).toBe(true);
  });
});

describe("CoverageEntrySchema", () => {
  it("acepta scope: recorded", () => {
    const result = CoverageEntrySchema.safeParse({
      scope: "recorded",
      screenIds: ["home"],
      producedBy: {
        agent: "mapeador-mcp" as const,
        version: "0.1.0",
        at: "2026-09-02T10:00:00.000Z",
      },
      complete: true,
    });
    expect(result.success).toBe(true);
  });

  it("acepta scope: auto-recorded", () => {
    const result = CoverageEntrySchema.safeParse({
      scope: "auto-recorded",
      screenIds: ["home"],
      producedBy: {
        agent: "mapeador-mcp" as const,
        version: "0.1.0",
        at: "2026-09-02T10:00:00.000Z",
      },
      complete: true,
    });
    expect(result.success).toBe(true);
  });
});
