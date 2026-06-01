import { getApiErrorMessage, normalizeApiBlobError } from "@/lib/api";

describe("API Blob error normalization", () => {
  it("restores JSON error messages returned by download endpoints", async () => {
    const error = {
      isAxiosError: true,
      response: {
        data: new Blob([JSON.stringify({ code: "REPORT_TOO_LARGE", error: "Aplique filtros antes de exportar." })], {
          type: "application/json",
        }),
        headers: { "content-type": "application/json; charset=utf-8" },
      },
    };

    await normalizeApiBlobError(error);

    expect(getApiErrorMessage(error)).toBe("Aplique filtros antes de exportar.");
  });
});
