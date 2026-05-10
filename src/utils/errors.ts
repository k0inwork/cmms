import { HTTPException } from "hono/http-exception";

export class NotFoundError extends HTTPException {
  readonly code = "NOT_FOUND";
  constructor(entity: string, id: string) {
    super(404, {
      message: `${entity} with id '${id}' not found`,
    });
  }
}

export class ConflictError extends HTTPException {
  readonly code = "CONFLICT";
  constructor(message: string) {
    super(409, { message });
  }
}

export class ValidationError extends HTTPException {
  readonly code = "VALIDATION_ERROR";
  constructor(message: string) {
    super(400, { message });
  }
}

export class ForbiddenError extends HTTPException {
  readonly code = "FORBIDDEN";
  constructor(message: string) {
    super(403, { message });
  }
}

export class AssetError extends HTTPException {
  readonly code: string;
  constructor(status: 400 | 404 | 409, code: string, message: string) {
    super(status, { message });
    this.code = code;
  }
}

/**
 * All custom app errors have a `code` property.
 * This type guard checks for that.
 */
export function hasErrorCode(err: unknown): err is { code: string; message: string; status: number } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as Record<string, unknown>).code === "string"
  );
}
