import { runI18nChanges } from "./i18n-changes.js";

process.exitCode = runI18nChanges(process.argv.slice(2));
