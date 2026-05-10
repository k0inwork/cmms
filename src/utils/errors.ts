import { HTTPException } from "hono/http-exception";

export class NotFoundError extends HTTPException {
  constructor(entity: string, id: string) {
    super(404, {
      message: `${entity} with id '${id}' not found`,
    });
  }
}

export class ConflictError extends HTTPException {
  constructor(message: string) {
    super(409, { message });
  }
}

export class AssetError extends HTTPException {
  readonly code: string;
  constructor(status: 400 | 404 | 409, code: string, message: string) {
    super(status, { message });
    this.code = code;
  }
}
