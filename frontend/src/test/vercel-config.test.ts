import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Vercel SPA configuration", () => {
  it("serves the Vite entry point for browser routes", () => {
    const config = JSON.parse(readFileSync(resolve("vercel.json"), "utf8"));

    expect(config.rewrites).toContainEqual({
      source: "/(.*)",
      destination: "/index.html",
    });
  });

  it("adds nosniff to every frontend response", () => {
    const config = JSON.parse(readFileSync(resolve("vercel.json"), "utf8"));

    expect(config.headers).toContainEqual({
      source: "/(.*)",
      headers: [
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
      ],
    });
  });
});
