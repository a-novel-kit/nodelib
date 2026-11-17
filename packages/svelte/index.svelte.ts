/**
 * Svelte 5 helpers every platform shares: a retry that lives as long as its component, the planned
 * downtime a page shows, and the visitor's telemetry answer. The modules ship with their runes for
 * the consuming application's Svelte compiler. They live apart from nodelib-browser, so a SvelteKit
 * server build inlines this package alone and keeps one copy of nodelib-browser.
 */
export * from "./downtime.svelte.js";
export * from "./retry.svelte.js";
export * from "./telemetry.svelte.js";
