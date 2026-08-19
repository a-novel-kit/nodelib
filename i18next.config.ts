import { I18next } from "./packages/configs/i18next";

export default I18next({
  locales: ["en", "fr"],
  primaryLanguage: "en",
  catalogFormat: "yaml",
  rootDirectory: "packages/configs/fixtures/i18n",
  input: ["packages/configs/fixtures/i18n/**/*.svelte"],
  ignore: ["packages/configs/fixtures/i18n/generated/**"],
});
