import { z, ZodTypeAny } from "zod";

/**
 * Minimal JSON Schema -> Zod converter, scoped to what MCP tool inputSchemas
 * actually contain (object/string/number/boolean/array/enum, required[]).
 * This is intentionally not a general-purpose converter — it covers exactly
 * the shapes MCP tools emit, and falls back to z.any() for anything unrecognized
 * rather than throwing, so an unusual schema degrades gracefully instead of
 * breaking tool loading entirely.
 */
export function jsonSchemaToZod(schema: any): ZodTypeAny {
  if (!schema || typeof schema !== "object") return z.any();

  switch (schema.type) {
    case "string":
      return schema.enum ? z.enum(schema.enum as [string, ...string[]]) : z.string();

    case "number":
    case "integer":
      return z.number();

    case "boolean":
      return z.boolean();

    case "array": {
      const itemSchema = schema.items ? jsonSchemaToZod(schema.items) : z.any();
      return z.array(itemSchema);
    }

    case "object": {
      const props = schema.properties ?? {};
      const required: string[] = schema.required ?? [];
      const shape: Record<string, ZodTypeAny> = {};

      for (const [key, propSchema] of Object.entries(props)) {
        let fieldSchema = jsonSchemaToZod(propSchema);
        if (!required.includes(key)) {
          fieldSchema = fieldSchema.optional();
        }
        shape[key] = fieldSchema;
      }
      // Allow additional keys the schema didn't explicitly declare, rather than
      // rejecting outright — MCP tool schemas aren't always perfectly strict.
      return z.object(shape).passthrough();
    }

    default:
      return z.any();
  }
}
