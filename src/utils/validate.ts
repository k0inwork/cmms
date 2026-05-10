import type { Context, Next } from "hono";
import type { ZodError } from "zod";
import { z } from "zod";

/**
 * Consistent validation error hook for @hono/zod-validator.
 * Pass as the third argument to any zValidator() call.
 */
export function validationHook(result: { success: boolean; error?: ZodError }, c: Context) {
  if (!result.success) {
    return c.json(
      {
        error: "Validation failed",
        details: result.error?.flatten().fieldErrors,
      },
      400,
    );
  }
}

const uuidSchema = z.string().uuid();

/**
 * Middleware that validates path params are valid UUIDs.
 * Usage: app.get("/:id", validateUuidParams("id"), handler)
 */
export function validateUuidParams(...paramNames: string[]) {
  return async (c: Context, next: Next) => {
    for (const name of paramNames) {
      const value = c.req.param(name);
      if (value) {
        const result = uuidSchema.safeParse(value);
        if (!result.success) {
          return c.json(
            {
              error: "Validation failed",
              details: { [name]: ["Invalid UUID"] },
            },
            400,
          );
        }
      }
    }
    await next();
  };
}
