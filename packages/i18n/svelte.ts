import { createContext } from "svelte";

import type { i18n } from "i18next";

/**
 * Reads, provides and detects the isolated i18next instance of the current Svelte component tree. A
 * shared component that must also render outside a provider checks `hasI18nContext()` first, and
 * falls back to its own messages.
 */
export const [getI18nContext, setI18nContext, hasI18nContext] = createContext<i18n>();
