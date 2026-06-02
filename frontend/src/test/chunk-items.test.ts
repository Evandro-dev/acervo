import { describe, expect, it } from "vitest";

import { chunkItems } from "@/lib/chunk-items";

describe("chunkItems", () => {
  it("splits a large queue while preserving item order", () => {
    const items = Array.from({ length: 27 }, (_, index) => index + 1);

    expect(chunkItems(items, 25)).toEqual([
      Array.from({ length: 25 }, (_, index) => index + 1),
      [26, 27],
    ]);
  });

  it("rejects invalid chunk sizes", () => {
    expect(() => chunkItems([1], 0)).toThrow("inteiro positivo");
  });
});
