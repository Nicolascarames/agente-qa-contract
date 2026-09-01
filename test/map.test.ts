import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAppMap } from "../src/index.js";

const fixturesDir = new URL("../fixtures/", import.meta.url);

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(name, fixturesDir), "utf8"));
}

describe("parseAppMap", () => {
  it("acepta un map.json válido", () => {
    const result = parseAppMap(loadFixture("map-valido.json"));
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
  ])("rechaza %s con path %s", (fixture, expectedPath) => {
    const result = parseAppMap(loadFixture(fixture));
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("se esperaba ok: false");
    }
    expect(result.issues[0]?.path).toBe(expectedPath);
  });
});
