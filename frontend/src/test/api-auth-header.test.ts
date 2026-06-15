import { shouldAttachAuthorizationHeader } from "@/lib/api";

describe("API Authorization header policy", () => {
  it("does not attach the token to public list endpoints", () => {
    expect(
      shouldAttachAuthorizationHeader({
        method: "get",
        url: "/articles",
        params: { status: "published", page: 1, pageSize: 12 },
      }),
    ).toBe(false);

    expect(
      shouldAttachAuthorizationHeader({
        method: "get",
        url: "/events",
        params: { includeArticles: "none", page: 1, pageSize: 3 },
      }),
    ).toBe(false);

    expect(
      shouldAttachAuthorizationHeader({
        method: "get",
        url: "/areas",
        params: { includeEmpty: true },
      }),
    ).toBe(false);
  });

  it("attaches the token to protected reads", () => {
    expect(
      shouldAttachAuthorizationHeader({
        method: "get",
        url: "/auth/me",
      }),
    ).toBe(true);

    expect(
      shouldAttachAuthorizationHeader({
        method: "get",
        url: "/reports/articles/count",
      }),
    ).toBe(true);

    expect(
      shouldAttachAuthorizationHeader({
        method: "get",
        url: "/events",
        params: { includeArticles: "all" },
      }),
    ).toBe(true);

    expect(
      shouldAttachAuthorizationHeader({
        method: "get",
        url: "/articles?status=all",
      }),
    ).toBe(true);
  });

  it("attaches the token to mutations except public authentication requests", () => {
    expect(
      shouldAttachAuthorizationHeader({
        method: "post",
        url: "/articles/import",
      }),
    ).toBe(true);

    expect(
      shouldAttachAuthorizationHeader({
        method: "post",
        url: "/auth/login",
      }),
    ).toBe(false);

    expect(
      shouldAttachAuthorizationHeader({
        method: "post",
        url: "/auth/register",
      }),
    ).toBe(false);
  });
});
