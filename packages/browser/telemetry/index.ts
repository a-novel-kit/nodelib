/**
 * Browser telemetry behind the visitor's consent: the consent store, and Grafana Faro's SDK loaded
 * only once the visitor accepts.
 */
export { TELEMETRY_CONSENT_COOKIE, type TelemetryChoice, parseTelemetryChoice } from "./consent.js";
export * from "./telemetry.js";
