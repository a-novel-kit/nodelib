import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, posix } from "node:path";
import { parseArgs } from "node:util";

import { parse } from "yaml";

const pluralSuffix = /_(?:zero|one|two|few|many|other)$/;
const catalogFile = /\.(?:json|ya?ml)$/;

/** Messages of one locale, keyed by `namespace:key`. */
export type Catalog = ReadonlyMap<string, string>;

/** One locale's messages at the merge base and at HEAD. */
export interface Revision {
  base: Catalog;
  head: Catalog;
}

/** A key's plural forms, which compare as one message since locales use different plural categories. */
interface Group {
  forms: string;
  translated: boolean;
}

/**
 * Lists the keys whose translation the branch left empty: new keys and emptied translations. A gap
 * already present at the merge base is existing debt and is not reported again.
 */
export function findGaps(translation: Revision): string[] {
  const base = groupPluralForms(translation.base);
  return [...groupPluralForms(translation.head)]
    .filter(([key, group]) => !group.translated && (base.get(key)?.translated ?? true))
    .map(([key]) => key);
}

/**
 * Lists the keys whose source message changed since the merge base while the translation kept its
 * value. A new key or an empty translation is a gap instead.
 */
export function findDrift(source: Revision, translation: Revision): string[] {
  const sourceBase = groupPluralForms(source.base);
  const translationBase = groupPluralForms(translation.base);
  const translationHead = groupPluralForms(translation.head);

  return [...groupPluralForms(source.head)]
    .filter(([key, group]) => {
      const previous = sourceBase.get(key);
      const translated = translationHead.get(key);
      return (
        previous !== undefined &&
        previous.forms !== group.forms &&
        translated?.translated === true &&
        translated.forms === translationBase.get(key)?.forms
      );
    })
    .map(([key]) => key);
}

function groupPluralForms(catalog: Catalog): Map<string, Group> {
  const groups = new Map<string, [string, string][]>();
  for (const [key, message] of catalog) {
    const name = key.replace(pluralSuffix, "");
    groups.set(name, [...(groups.get(name) ?? []), [key, message]]);
  }
  return new Map(
    [...groups].map(([name, forms]) => [
      name,
      {
        forms: JSON.stringify(forms.toSorted(([a], [b]) => a.localeCompare(b))),
        translated: forms.some(([, message]) => message !== ""),
      },
    ])
  );
}

function flatten(value: unknown, prefix: string, into: Map<string, string>): void {
  if (typeof value === "string") into.set(prefix, value);
  else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix.endsWith(":") ? prefix + key : `${prefix}.${key}`, into);
    }
  }
}

function readCatalog(files: readonly string[], read: (file: string) => string | undefined): Catalog {
  const messages = new Map<string, string>();
  for (const file of files) {
    const content = read(file);
    // YAML 1.2 is a superset of JSON, so one parser reads both catalog formats.
    if (content !== undefined) flatten(parse(content), `${file.replace(catalogFile, "")}:`, messages);
  }
  return messages;
}

function attempt(read: () => string): string | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

const checks = {
  gaps: {
    find: (_source: Revision, translation: Revision) => findGaps(translation),
    problem: "Translations left empty by this branch",
    fix: "Translate each key, or apply allow-incomplete-translations to render the source text.",
  },
  drift: {
    find: findDrift,
    problem: "Source messages changed while their translations did not",
    fix: "Update each translation, give a changed meaning a new key, or apply allow-translation-drift.",
  },
};

/** Options for one run of `nodelib-i18n-changes`. */
export interface I18nChangesOptions {
  /** Directory the command runs in. Defaults to the process working directory. */
  cwd?: string;
  /** Receives the report. Defaults to standard error. */
  write?: (text: string) => void;
}

/** Runs `nodelib-i18n-changes` with its command-line arguments and returns the exit code. */
export function runI18nChanges(args: readonly string[], options: I18nChangesOptions = {}): number {
  const { cwd = process.cwd(), write = (text: string) => process.stderr.write(text) } = options;
  const { positionals, values } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      source: { type: "string" },
      catalogs: { type: "string", default: "src/lib/i18n/locales" },
      base: { type: "string", default: "origin/master" },
    },
  });

  const [name] = positionals;
  if (name !== "gaps" && name !== "drift") throw new TypeError("Expected the check to run: gaps or drift");
  if (!values.source) throw new TypeError("Expected the source locale: --source <locale>");
  const check = checks[name];
  const { source: sourceLocale, catalogs, base } = values;

  const git = (...gitArgs: string[]) =>
    execFileSync("git", gitArgs, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const mergeBase = git("merge-base", "HEAD", base).trim();
  const files = readdirSync(join(cwd, catalogs, sourceLocale)).filter((file) => catalogFile.test(file));
  const revision = (locale: string): Revision => ({
    base: readCatalog(files, (file) =>
      attempt(() => git("show", `${mergeBase}:./${posix.join(catalogs, locale, file)}`))
    ),
    head: readCatalog(files, (file) => attempt(() => readFileSync(join(cwd, catalogs, locale, file), "utf8"))),
  });

  const source = revision(sourceLocale);
  const problems = readdirSync(join(cwd, catalogs), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== sourceLocale)
    .flatMap(({ name: locale }) => check.find(source, revision(locale)).map((key) => `  ${locale} ${key}`));

  if (problems.length === 0) return 0;
  write(`${check.problem}:\n${problems.join("\n")}\n${check.fix}\n`);
  return 1;
}
