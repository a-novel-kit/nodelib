import { Yaml } from "./yaml";

import type { Plugin } from "vite";
import { describe, expect, it } from "vitest";

type Transform = Exclude<Plugin["transform"], undefined | { handler: unknown }>;

function transform(): Transform {
  const hook = Yaml().transform;
  if (typeof hook !== "function") throw new TypeError("Expected a Vite transform hook");
  return hook;
}

describe("Yaml", () => {
  it("turns a YAML catalog into a static ES module", async () => {
    const result = await transform().call(
      {} as never,
      "shell:\n  home: Home\n  count_one: One item\n",
      "/workspace/src/lib/i18n/locales/en/common.yaml"
    );

    expect(result).toEqual({
      code: 'export default {"shell":{"home":"Home","count_one":"One item"}};',
      map: null,
    });
  });

  it("ignores modules outside YAML files", () => {
    expect(transform().call({} as never, "export default {};", "/workspace/catalog.ts")).toBeUndefined();
  });
});
