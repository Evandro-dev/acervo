import { getBrandedNavigationItemStateClassName } from "@/lib/branded-navigation";

describe("getBrandedNavigationItemStateClassName", () => {
  it("forces readable white text over the branded active background", () => {
    expect(getBrandedNavigationItemStateClassName(true)).toContain("!text-primary-foreground");
  });

  it("keeps inactive navigation items neutral", () => {
    expect(getBrandedNavigationItemStateClassName(false)).toBe("text-foreground/70 hover:bg-muted");
  });
});
