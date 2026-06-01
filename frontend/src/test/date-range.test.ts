import { dateRangeFromIsoDates, dateRangeToIsoDates, formatDateRangeLabel } from "@/lib/date-range";

describe("date range helpers", () => {
  it("formats readable period labels in Portuguese", () => {
    expect(formatDateRangeLabel({ from: new Date(2026, 0, 1), to: new Date(2026, 0, 5) })).toBe(
      "1 a 5 de janeiro de 2026",
    );
    expect(formatDateRangeLabel({ from: new Date(2026, 0, 1), to: new Date(2026, 1, 5) })).toBe(
      "1 de janeiro a 5 de fevereiro de 2026",
    );
  });

  it("converts report filters between ISO dates and calendar ranges", () => {
    const range = dateRangeFromIsoDates("2026-01-01", "2026-06-30");

    expect(range?.from).toEqual(new Date(2026, 0, 1));
    expect(range?.to).toEqual(new Date(2026, 5, 30));
    expect(dateRangeToIsoDates(range)).toEqual({
      dateFrom: "2026-01-01",
      dateTo: "2026-06-30",
    });
  });

  it("ignores invalid ISO date values", () => {
    expect(dateRangeFromIsoDates("2026-02-31", undefined)).toBeUndefined();
  });
});
