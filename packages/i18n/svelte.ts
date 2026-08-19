import { createContext } from "svelte";

import type { i18n } from "i18next";

const [readI18nContext, writeI18nContext] = createContext<i18n>();

/** Reads the isolated i18next instance provided for the current Svelte component tree. */
export const getI18nContext = readI18nContext;

/** Provides an isolated i18next instance to the current Svelte component tree. */
export const setI18nContext = writeI18nContext;
