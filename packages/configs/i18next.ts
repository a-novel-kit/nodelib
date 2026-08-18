import { type I18nextToolkitConfig, type Plugin, defineConfig } from "i18next-cli";
import I18nextSveltePlugin from "i18next-cli-plugin-svelte";

type ExtractConfig = I18nextToolkitConfig["extract"];
type LintConfig = NonNullable<I18nextToolkitConfig["lint"]>;
type TypesConfig = NonNullable<I18nextToolkitConfig["types"]>;
type SharedExtractOption =
  | "defaultNS"
  | "extractFromComments"
  | "generateBasePluralForms"
  | "ignore"
  | "indentation"
  | "input"
  | "mergeNamespaces"
  | "output"
  | "outputFormat"
  | "primaryLanguage"
  | "removeUnusedKeys"
  | "secondaryLanguages"
  | "sort"
  | "warnOnConflicts";

/** Defines product policy layered over the shared static i18next catalog contract. */
export interface I18nextOptions {
  /** Locales whose static catalogs are checked and synchronized. */
  locales: readonly string[];
  /** Source locale that supplies authoritative messages and generated types. */
  primaryLanguage: string;
  /** Locales synchronized from the source locale. */
  secondaryLanguages?: readonly string[];
  /** Namespace used by translation calls without an explicit namespace. */
  defaultNamespace?: string;
  /** Directory containing product locales and generated declarations. */
  rootDirectory?: string;
  /** Source globs scanned for statically discoverable translation calls. */
  input?: ExtractConfig["input"];
  /** Source globs excluded from extraction. */
  ignore?: ExtractConfig["ignore"];
  /** Extraction settings that reflect a product-specific message format. */
  extract?: Omit<Partial<ExtractConfig>, SharedExtractOption>;
  /** Lint settings that reflect a product-specific source convention. */
  lint?: LintConfig;
  /** Generated-type settings that reflect a product-specific output layout. */
  types?: Partial<TypesConfig>;
  /** Additional extraction plugins required by the product's source formats. */
  plugins?: readonly Plugin[];
}

/** Builds the static JSON i18next CLI configuration shared by Svelte applications. */
export function I18next(options: I18nextOptions): I18nextToolkitConfig {
  const defaultNamespace = options.defaultNamespace ?? "common";
  const rootDirectory = options.rootDirectory ?? "src/lib/i18n";
  const localeDirectory = `${rootDirectory}/locales`;
  const generatedDirectory = `${rootDirectory}/generated`;
  const secondaryLanguages =
    options.secondaryLanguages ?? options.locales.filter((locale) => locale !== options.primaryLanguage);

  return defineConfig({
    locales: [...options.locales],
    extract: {
      functions: ["t", "*.t"],
      ...options.extract,
      defaultNS: defaultNamespace,
      extractFromComments: false,
      generateBasePluralForms: false,
      ignore: options.ignore ?? ["src/**/*.test.ts", `${generatedDirectory}/**`],
      indentation: 2,
      input: options.input ?? ["src/**/*.{svelte,ts}"],
      mergeNamespaces: false,
      output: `${localeDirectory}/{{language}}/{{namespace}}.json`,
      outputFormat: "json",
      primaryLanguage: options.primaryLanguage,
      removeUnusedKeys: true,
      secondaryLanguages: [...secondaryLanguages],
      sort: true,
      warnOnConflicts: "error",
    },
    lint: {
      checkConcatenation: "error",
      checkInterpolationParams: true,
      checkPunctuationConcatenation: "error",
      ...options.lint,
    },
    types: {
      basePath: `${localeDirectory}/${options.primaryLanguage}`,
      input: [`${localeDirectory}/${options.primaryLanguage}/**/*.json`],
      output: `${generatedDirectory}/i18next.d.ts`,
      resourcesFile: `${generatedDirectory}/resources.d.ts`,
      ...options.types,
    },
    plugins: [new I18nextSveltePlugin(), ...(options.plugins ?? [])],
  });
}
