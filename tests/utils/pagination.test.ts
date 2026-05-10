import { describe, it, expect } from "vitest";
import {
  paginationSchema,
  buildCursorQuery,
  paginatedResponse,
} from "../../src/utils/pagination.js";

describe("paginationSchema", () => {
  it("applies default limit of 25", () => {
    const result = paginationSchema.parse({});
    expect(result.limit).toBe(25);
  });

  it("clamps limit between 1 and 100", () => {
    expect(paginationSchema.parse({ limit: "0" }).limit).toBe(1);
    expect(paginationSchema.parse({ limit: "200" }).limit).toBe(100);
    expect(paginationSchema.parse({ limit: "50" }).limit).toBe(50);
  });

  it("parses cursor as UUID", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const result = paginationSchema.parse({ cursor: uuid });
    expect(result.cursor).toBe(uuid);
  });

  it("allows undefined cursor", () => {
    const result = paginationSchema.parse({});
    expect(result.cursor).toBeUndefined();
  });
});

describe("buildCursorQuery", () => {
  it("returns empty object when no cursor", () => {
    expect(buildCursorQuery(undefined)).toEqual({});
  });

  it("returns cursor + skip when cursor provided", () => {
    const result = buildCursorQuery("some-uuid");
    expect(result).toEqual({ cursor: { id: "some-uuid" }, skip: 1 });
  });
});

describe("paginatedResponse", () => {
  it("returns has_more false when items fit within limit", () => {
    const items = [{ id: "1" }, { id: "2" }];
    const result = paginatedResponse(items, 5);

    expect(result.data).toHaveLength(2);
    expect(result.pagination.has_more).toBe(false);
    expect(result.pagination.next_cursor).toBeNull();
  });

  it("trims to limit and sets next_cursor when has_more", () => {
    const items = [{ id: "1" }, { id: "2" }, { id: "3" }];
    const result = paginatedResponse(items, 2);

    expect(result.data).toHaveLength(2);
    expect(result.pagination.has_more).toBe(true);
    expect(result.pagination.next_cursor).toBe("2");
  });

  it("handles empty items", () => {
    const result = paginatedResponse([], 10);
    expect(result.data).toHaveLength(0);
    expect(result.pagination.has_more).toBe(false);
  });
});
