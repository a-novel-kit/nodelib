import { NAVIGATION_RAIL_COOKIE, parseNavigationRail, saveNavigationRail } from "./rail";

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  document.cookie = `${NAVIGATION_RAIL_COOKIE}=; Path=/; Max-Age=0`;
});

describe("parseNavigationRail", () => {
  it.each([
    { name: "reads a collapsed rail", value: "collapsed", want: "collapsed" },
    { name: "reads an expanded rail", value: "expanded", want: "expanded" },
    { name: "expands an unknown value", value: "narrow", want: "expanded" },
    { name: "expands for a visitor who never chose", value: undefined, want: "expanded" },
  ])("$name", ({ value, want }) => {
    expect(parseNavigationRail(value)).toBe(want);
  });
});

describe("saveNavigationRail", () => {
  it("keeps the rail for a year", () => {
    const write = vi.spyOn(document, "cookie", "set");

    saveNavigationRail("collapsed");

    expect(write).toHaveBeenCalledWith(`${NAVIGATION_RAIL_COOKIE}=collapsed; Path=/; Max-Age=31536000; SameSite=Lax`);
    expect(document.cookie).toContain(`${NAVIGATION_RAIL_COOKIE}=collapsed`);
  });

  it("shares the rail with every host of a domain", () => {
    const write = vi.spyOn(document, "cookie", "set");

    saveNavigationRail("expanded", { domain: "storyverse.fr" });

    expect(write).toHaveBeenCalledWith(expect.stringContaining("; Domain=storyverse.fr"));
  });
});
