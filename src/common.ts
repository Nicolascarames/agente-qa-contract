import { z } from "zod";

/** Vocabulario compartido entre `map.ts` y `project.ts`: en qué entorno se ejecuta o se permite algo. */
export const EnvironmentSchema = z.enum(["dev", "test", "staging", "production"]);
export type Environment = z.infer<typeof EnvironmentSchema>;
