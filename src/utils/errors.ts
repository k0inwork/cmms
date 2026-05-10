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
