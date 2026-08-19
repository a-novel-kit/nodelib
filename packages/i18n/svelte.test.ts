import { getI18nContext, setI18nContext } from "./svelte";

import { describe, expect, it } from "vitest";

describe("Svelte i18n context exports", () => {
  it("exposes native provider and consumer accessors", () => {
    expect(getI18nContext).toBeTypeOf("function");
    expect(setI18nContext).toBeTypeOf("function");
  });
});
