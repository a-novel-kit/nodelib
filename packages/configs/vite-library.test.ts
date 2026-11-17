import { ViteLibrary } from "./vite-library";

import { describe, expect, it } from "vitest";

const manifest = {
  dependencies: { yaml: "^2.9.0" },
  peerDependencies: { zod: "^4.6.7", "@a-novel-kit/nodelib-browser": "*" },
};

/** Builds a client's config, and reads the file name of each entry and whether an import stays external. */
function library(entry: Record<string, string>) {
  const { build } = ViteLibrary("/workspace/pkg/js/rest", entry, manifest);
  const output = build?.rollupOptions?.output as { entryFileNames: (chunk: { name: string }) => string };
  const external = build?.rollupOptions?.external as (id: string) => boolean;
  const fileName = (name: string) => output.entryFileNames({ name });
  return { build, fileName, external };
}

describe("ViteLibrary", () => {
  it("builds each entry of the package into its own dist", () => {
    const { build } = library({ src: "src/index.ts" });

    expect(build).toMatchObject({
      outDir: "/workspace/pkg/js/rest/dist",
      emptyOutDir: true,
      lib: { entry: { src: "/workspace/pkg/js/rest/src/index.ts" }, formats: ["es"] },
      ssr: true,
      sourcemap: true,
    });
  });

  it.each<{ name: string; entry: Record<string, string>; chunk: string; file: string }>([
    { name: "a named entry", entry: { src: "src/index.ts" }, chunk: "src", file: "src/index.es.js" },
    { name: "the index entry", entry: { index: "index.ts" }, chunk: "index", file: "index.es.js" },
    {
      name: "a rune entry",
      entry: { svelte: "svelte/index.svelte.ts" },
      chunk: "svelte",
      file: "svelte/index.svelte.js",
    },
  ])("names the file of $name", ({ entry, chunk, file }) => {
    expect(library(entry).fileName(chunk)).toBe(file);
  });

  it.each([
    { id: "zod", external: true },
    { id: "@a-novel-kit/nodelib-browser/http", external: true },
    { id: "yaml", external: true },
    { id: "zod-extra", external: false },
    { id: "./api", external: false },
  ])("keeps $id external: $external", ({ id, external }) => {
    expect(library({ src: "src/index.ts" }).external(id)).toBe(external);
  });
});
