import { findDrift, findGaps, runI18nChanges } from "./i18n-changes";

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

type Messages = Record<string, string>;

function revision(base: Messages, head: Messages) {
  return { base: new Map(Object.entries(base)), head: new Map(Object.entries(head)) };
}

const pluralSource = { "common:items_one": "{{count}} item", "common:items_other": "{{count}} items" };
const pluralTranslation = {
  "common:items_one": "{{count}} élément",
  "common:items_many": "{{count}} éléments",
  "common:items_other": "{{count}} éléments",
};

describe("findGaps", () => {
  it.each<{ name: string; translation: [Messages, Messages]; gaps: string[] }>([
    {
      name: "reports a new key left empty",
      translation: [{}, { "common:home": "" }],
      gaps: ["common:home"],
    },
    {
      name: "reports a translation the branch emptied",
      translation: [{ "common:home": "Revenir à l’accueil" }, { "common:home": "" }],
      gaps: ["common:home"],
    },
    {
      name: "leaves a gap already on the base branch as existing debt",
      translation: [{ "common:home": "" }, { "common:home": "" }],
      gaps: [],
    },
    {
      name: "accepts a translated key",
      translation: [{}, { "common:home": "Revenir à l’accueil" }],
      gaps: [],
    },
    {
      name: "accepts a plural group with any translated form",
      translation: [{}, { "common:items_one": "{{count}} élément", "common:items_many": "", "common:items_other": "" }],
      gaps: [],
    },
  ])("$name", ({ translation, gaps }) => {
    expect(findGaps(revision(...translation))).toEqual(gaps);
  });
});

describe("findDrift", () => {
  it.each<{ name: string; source: [Messages, Messages]; translation: [Messages, Messages]; drift: string[] }>([
    {
      name: "reports a changed source whose translation kept its value",
      source: [{ "common:home": "Back to home" }, { "common:home": "Return home" }],
      translation: [{ "common:home": "Retour à l’accueil" }, { "common:home": "Retour à l’accueil" }],
      drift: ["common:home"],
    },
    {
      name: "accepts a translation updated with its source",
      source: [{ "common:home": "Back to home" }, { "common:home": "Return home" }],
      translation: [{ "common:home": "Retour à l’accueil" }, { "common:home": "Revenir à l’accueil" }],
      drift: [],
    },
    {
      name: "ignores an unchanged source",
      source: [{ "common:home": "Return home" }, { "common:home": "Return home" }],
      translation: [{ "common:home": "Revenir à l’accueil" }, { "common:home": "Revenir à l’accueil" }],
      drift: [],
    },
    {
      name: "leaves a new source key to the gap check",
      source: [{}, { "common:home": "Return home" }],
      translation: [{}, { "common:home": "" }],
      drift: [],
    },
    {
      name: "leaves an empty translation to the gap check",
      source: [{ "common:home": "Back to home" }, { "common:home": "Return home" }],
      translation: [{ "common:home": "" }, { "common:home": "" }],
      drift: [],
    },
    {
      name: "ignores a removed source key",
      source: [{ "common:home": "Back to home" }, {}],
      translation: [{ "common:home": "Retour à l’accueil" }, { "common:home": "Retour à l’accueil" }],
      drift: [],
    },
    {
      name: "reports a plural group once when its translation forms all kept their values",
      source: [pluralSource, { ...pluralSource, "common:items_other": "{{count}} entries" }],
      translation: [pluralTranslation, pluralTranslation],
      drift: ["common:items"],
    },
    {
      name: "accepts a plural group whose translation updated any form",
      source: [pluralSource, { ...pluralSource, "common:items_other": "{{count}} entries" }],
      translation: [pluralTranslation, { ...pluralTranslation, "common:items_other": "{{count}} entrées" }],
      drift: [],
    },
  ])("$name", ({ source, translation, drift }) => {
    expect(findDrift(revision(...source), revision(...translation))).toEqual(drift);
  });
});

describe("runI18nChanges", () => {
  const repositories: string[] = [];

  afterEach(() => {
    for (const repository of repositories.splice(0)) rmSync(repository, { force: true, recursive: true });
  });

  /** Commits JSON catalogs on master, then leaves `head` as uncommitted edits on a feature branch. */
  function repository(base: Record<"en" | "fr", Messages>, head: Record<"en" | "fr", Messages>): string {
    const cwd = mkdtempSync(join(tmpdir(), "nodelib-i18n-changes-"));
    repositories.push(cwd);
    const git = (...args: string[]) => execFileSync("git", args, { cwd, stdio: "ignore" });
    const write = (catalogs: Record<"en" | "fr", Messages>) => {
      for (const [locale, messages] of Object.entries(catalogs)) {
        mkdirSync(join(cwd, "locales", locale), { recursive: true });
        writeFileSync(join(cwd, "locales", locale, "common.json"), JSON.stringify(messages));
      }
    };

    git("init", "--quiet", "--initial-branch=master");
    write(base);
    git("add", ".");
    git("-c", "user.name=test", "-c", "user.email=test@example.test", "commit", "--quiet", "-m", "base");
    git("switch", "--quiet", "-c", "feature");
    write(head);
    return cwd;
  }

  function run(check: string, cwd: string) {
    const output: string[] = [];
    const code = runI18nChanges([check, "--source", "en", "--catalogs", "locales", "--base", "master"], {
      cwd,
      write: (text) => output.push(text),
    });
    return { code, output: output.join("") };
  }

  it("reports drift between the merge base and the working tree", () => {
    const cwd = repository(
      { en: { home: "Back to home" }, fr: { home: "Retour à l’accueil" } },
      { en: { home: "Return home" }, fr: { home: "Retour à l’accueil" } }
    );

    expect(run("drift", cwd)).toEqual({
      code: 1,
      output: expect.stringContaining("  fr common:home\n") as string,
    });
    expect(run("gaps", cwd)).toEqual({ code: 0, output: "" });
  });

  it("reports a gap the branch introduced and passes once it is translated", () => {
    const gap = repository({ en: {}, fr: {} }, { en: { home: "Return home" }, fr: { home: "" } });
    const translated = repository(
      { en: {}, fr: {} },
      { en: { home: "Return home" }, fr: { home: "Revenir à l’accueil" } }
    );

    expect(run("gaps", gap)).toEqual({ code: 1, output: expect.stringContaining("  fr common:home\n") as string });
    expect(run("gaps", translated)).toEqual({ code: 0, output: "" });
  });

  it.each([
    [["typo", "--source", "en"], "Expected the check to run: gaps or drift"],
    [["gaps"], "Expected the source locale: --source <locale>"],
  ])("rejects %j", (args, message) => {
    expect(() => runI18nChanges(args)).toThrow(message);
  });
});
