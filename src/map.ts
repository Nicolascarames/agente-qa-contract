import { z } from "zod";
import { EnvironmentSchema } from "./common.js";

/**
 * Quién produjo un dato del mapa y cuándo. Cada pieza del ecosistema que
 * escribe en `map.json` (crawler, mapeador-mcp, redactor, redactor-mcp,
 * generador, generador-mcp) se declara como autor de lo que aporta, igual
 * que una corrección manual de localizador hecha desde la interfaz web
 * (web-manual).
 */
export const ProvenanceSchema = z
  .object({
    agent: z.enum([
      "crawler",
      "mapeador-mcp",
      "redactor",
      "redactor-mcp",
      "generador",
      "generador-mcp",
      "web-manual",
    ]),
    version: z.string().min(1),
    at: z.string().datetime(),
  })
  .strict();

export const CoverageEntrySchema = z
  .object({
    scope: z.enum(["all", "goal", "units", "recorded", "auto-recorded"]),
    goal: z.string().optional(),
    screenIds: z.array(z.string()),
    producedBy: ProvenanceSchema,
    complete: z.boolean(),
  })
  .strict();

/** Set cuando el locator usa un selector posicional (`.nth()`, `.first()`, `.last()`): explica por qué. */
export const LocatorFragilitySchema = z
  .object({
    reason: z.string(),
  })
  .strict();
export type LocatorFragility = z.infer<typeof LocatorFragilitySchema>;

/** Cómo se obtuvo el locator: determina qué tan fiable es (ver `confidenceForStrategy`). */
export const LocatorStrategySchema = z.enum([
  "recorded",
  "generated",
  "role",
  "label",
  "testid",
  "attribute",
  "container",
  "positional",
]);
export type LocatorStrategy = z.infer<typeof LocatorStrategySchema>;

export const LocatorEntrySchema = z
  .object({
    name: z.string().min(1),
    kind: z.enum(["input", "button", "link", "select", "text", "heading"]),
    accessibleName: z.string().optional(),
    ts: z.string().min(1),
    /**
     * Cuántos elementos matchea `ts` en la página real. Normalmente 1 (un elemento único),
     * pero puede ser mayor cuando la entrada representa un GRUPO de elementos idénticos
     * (p.ej. un botón "Editar" repetido por fila de una tabla) acotado por un patrón de
     * localizador verificado por contenedor: "verificado" para un grupo significa que el
     * patrón dio `count()` igual al tamaño real del grupo, no que sea ambiguo.
     */
    count: z.number().int().min(1),
    /** Set cuando el candidato en bruto matcheaba más de un elemento y una región lo acotó. */
    disambiguatedBy: z.string().optional(),
    /** Set cuando el locator solo existe en un estado no-por-defecto de la pantalla. */
    stateId: z.string().optional(),
    attributes: z.record(z.string(), z.string()).optional(),
    producedBy: ProvenanceSchema,
    verifiedAt: z.string(),
    fragile: LocatorFragilitySchema.optional(),
    strategy: LocatorStrategySchema.optional(),
  })
  .strict();

/**
 * Traduce la estrategia con la que se obtuvo un locator a un nivel de confianza.
 * Tabla fija, no depende de más contexto: recorded/generated/role/testid → alta;
 * label/attribute/container → media; positional → baja.
 */
export function confidenceForStrategy(strategy: LocatorStrategy): "alta" | "media" | "baja" {
  switch (strategy) {
    case "recorded":
    case "generated":
    case "role":
    case "testid":
      return "alta";
    case "label":
    case "attribute":
    case "container":
      return "media";
    case "positional":
      return "baja";
  }
}

export const DataRecipeEntrySchema = z
  .object({
    values: z.record(z.string(), z.string()),
    producedBy: ProvenanceSchema,
    verifiedAt: z.string(),
  })
  .strict();

export const ScenarioCandidateSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    screenId: z.string().min(1),
    involvedScreens: z.array(z.string()),
    rationale: z.string(),
    tags: z.array(z.string()),
    producedBy: ProvenanceSchema,
  })
  .strict();

const ScreenReachedBySchema = z
  .object({
    entryScreenId: z.string().min(1),
    path: z.array(
      z
        .object({
          action: z.string().min(1),
          locator: z.string().min(1),
          data: z.string(),
        })
        .strict()
    ),
  })
  .strict();

export const ScreenStateSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    kind: z.enum(["modal", "drawer", "tab", "expanded", "toast", "other"]),
    enteredBy: z
      .object({
        action: z.enum(["click", "hover", "press"]),
        locatorName: z.string().min(1),
      })
      .strict(),
    producedBy: ProvenanceSchema,
    verifiedAt: z.string(),
  })
  .strict();

export const AmbiguousCandidateSchema = z
  .object({
    /** El identificador que habría tenido de no ser ambiguo. */
    name: z.string().min(1),
    kind: LocatorEntrySchema.shape.kind,
    accessibleName: z.string().optional(),
    /** La expresión que resultó ambigua. */
    ts: z.string().min(1),
    /** Razón de no entrar como LocatorEntry: ni un elemento único ni un grupo verificado con count() real. */
    count: z.number().int().min(2),
    stateId: z.string().optional(),
    producedBy: ProvenanceSchema,
    seenAt: z.string(),
  })
  .strict();

export const TransitionSchema = z
  .object({
    id: z.string().min(1),
    toScreenId: z.string().min(1),
    action: z.enum(["click", "fill", "select", "press", "navigate", "submit"]),
    /** Nombre de un LocatorEntry de esta pantalla. Ausente solo si action === "navigate". */
    locatorName: z.string().min(1).optional(),
    /** Claves de datos usadas en la transición; nunca secretos. */
    data: z.record(z.string(), z.string()).optional(),
    fromStateId: z.string().optional(),
    producedBy: ProvenanceSchema,
    /** Solo se escribe si la transición se recorrió de verdad. */
    verifiedAt: z.string(),
  })
  .strict()
  .superRefine((transition, ctx) => {
    if (transition.action !== "navigate" && transition.locatorName === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["locatorName"],
        message: "locatorName es obligatorio salvo cuando action es \"navigate\"",
      });
    }
  });

export const WriteActionSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["create", "update", "delete", "submit"]),
    locatorName: z.string().min(1),
    stateId: z.string().optional(),
    /** Qué campos se escriben. Nunca sus valores. */
    dataKeys: z.array(z.string()),
    /** Dónde se considera permitida esta escritura. */
    environments: z.array(EnvironmentSchema),
    /** true solo si se ejecutó y se comprobó el efecto. */
    confirmed: z.boolean(),
    producedBy: ProvenanceSchema,
    at: z.string(),
  })
  .strict();

export const ScreenSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    className: z.string().min(1),
    // Vacío ("") en una vista sin URL propia, junto con `reachedBy` (ver invariante 1 más abajo).
    urlTemplate: z.string(),
    signature: z.string().min(1),
    requiresAuth: z.boolean(),
    stale: z.boolean(),
    producedBy: ProvenanceSchema,
    texts: z.array(z.string()),
    /** Valores que tecleó el propio crawler. Excluidos de `texts`: son nuestro input, no copy de la app. */
    probeValues: z.array(z.string()),
    validDataRecipe: z.array(DataRecipeEntrySchema),
    locators: z.array(LocatorEntrySchema),
    states: z.array(ScreenStateSchema),
    ambiguous: z.array(AmbiguousCandidateSchema),
    transitions: z.array(TransitionSchema),
    writeActions: z.array(WriteActionSchema),
    /** Presente solo en una vista sin URL propia: cómo se llega a ella desde `entryScreenId`. */
    reachedBy: ScreenReachedBySchema.optional(),
  })
  .strict()
  .superRefine((screen, ctx) => {
    // Invariante 1: reachedBy presente solo si urlTemplate está vacío.
    if (screen.reachedBy !== undefined && screen.urlTemplate !== "") {
      ctx.addIssue({
        code: "custom",
        path: ["reachedBy"],
        message: "reachedBy solo puede estar presente cuando urlTemplate está vacío",
      });
    }

    // Invariante 2: probeValues disjunto de texts.
    const texts = new Set(screen.texts);
    const probeIndex = screen.probeValues.findIndex((value) => texts.has(value));
    if (probeIndex !== -1) {
      ctx.addIssue({
        code: "custom",
        path: ["probeValues", probeIndex],
        message: "probeValues no puede solapar con texts en la misma pantalla",
      });
    }
  });

export const AppMapSchema = z
  .object({
    schemaVersion: z.literal(4),
    appUrl: z.string().url(),
    createdAt: z.string(),
    coverage: z.array(CoverageEntrySchema),
    authenticated: z.boolean(),
    screens: z.array(ScreenSchema),
    scenarios: z.array(ScenarioCandidateSchema),
    stats: z
      .object({
        screens: z.number().int().min(0),
        locators: z.number().int().min(0),
        ambiguous: z.number().int().min(0),
        durationMs: z.number().int().min(0),
      })
      .strict(),
  })
  .strict();

export type Provenance = z.infer<typeof ProvenanceSchema>;
export type CoverageEntry = z.infer<typeof CoverageEntrySchema>;
export type LocatorEntry = z.infer<typeof LocatorEntrySchema>;
export type DataRecipeEntry = z.infer<typeof DataRecipeEntrySchema>;
export type ScenarioCandidate = z.infer<typeof ScenarioCandidateSchema>;
export type ScreenState = z.infer<typeof ScreenStateSchema>;
export type AmbiguousCandidate = z.infer<typeof AmbiguousCandidateSchema>;
export type Transition = z.infer<typeof TransitionSchema>;
export type WriteAction = z.infer<typeof WriteActionSchema>;
export type Screen = z.infer<typeof ScreenSchema>;
export type AppMap = z.infer<typeof AppMapSchema>;
