import { AppMapSchema, type AppMap } from "./map.js";

export * from "./map.js";

export interface ParseIssue {
  path: string;
  message: string;
}

export type ParseAppMapResult = { ok: true; map: AppMap } | { ok: false; issues: ParseIssue[] };

/**
 * Construye el `path` de un issue de Zod tal y como lo escribiría un humano:
 * segmentos de objeto con punto, segmentos de array con corchetes
 * (`screens[2].locators[0].count`, no `screens.2.locators.0.count`).
 */
function formatIssuePath(path: ReadonlyArray<PropertyKey>): string {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === "number") {
      return `${acc}[${segment}]`;
    }
    return acc.length === 0 ? String(segment) : `${acc}.${String(segment)}`;
  }, "");
}

/** Nunca lanza: traduce el resultado de Zod a un objeto plano, fácil de loguear o mostrar. */
export function parseAppMap(input: unknown): ParseAppMapResult {
  const result = AppMapSchema.safeParse(input);
  if (result.success) {
    return { ok: true, map: result.data };
  }

  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      path: formatIssuePath(issue.path),
      message: issue.message,
    })),
  };
}
