/**
 * Svelte 5 helpers every platform shares: a retry that lives as long as its component, the planned
 * downtime a page shows, and the visitor's telemetry answer. The modules ship with their runes for
 * the consuming application's Svelte compiler.
 */
export * from "./downtime.svelte.js";
export * from "./retry.svelte.js";
export * from "./telemetry.svelte.js";
