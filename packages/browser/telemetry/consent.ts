import { z } from "zod";

/** TelemetryChoice is the visitor's answer to the telemetry consent banner. */
export type TelemetryChoice = z.infer<typeof TelemetryChoiceSchema>;

const TelemetryChoiceSchema = z.enum(["accepted", "declined"]);

// A new version asks every visitor again. Raise it when telemetry starts collecting something the
// banner does not describe.
const CONSENT_VERSION = 1;

// The CNIL asks to renew a choice after six months, whatever the answer.
const CONSENT_LIFETIME_S = 182 * 24 * 60 * 60;

/**
 * Names the cookie that keeps the visitor's choice. A server reads it to render the choice the
 * browser keeps, so the page shows the same answer before and after it runs on the device.
 */
export const TELEMETRY_CONSENT_COOKIE = `telemetry-consent-v${CONSENT_VERSION}`;

/** Reads a choice from the consent cookie's value. It returns undefined when the visitor must choose. */
export function parseTelemetryChoice(value: string | undefined): TelemetryChoice | undefined {
  return TelemetryChoiceSchema.safeParse(value).data;
}

/**
 * Reads the visitor's choice from this browser. It returns undefined when the visitor must choose:
 * they never answered, answered an older version of the banner, answered more than six months ago,
 * or the page does not run in a browser, as on the server.
 */
export function readTelemetryChoice(): TelemetryChoice | undefined {
  if (typeof document === "undefined") return undefined;

  const prefix = `${TELEMETRY_CONSENT_COOKIE}=`;
  const cookie = document.cookie.split("; ").find((entry) => entry.startsWith(prefix));
  return parseTelemetryChoice(cookie?.slice(prefix.length));
}

/** Where the browser keeps a choice. */
export interface SaveTelemetryChoiceOptions {
  /**
   * Names the domain every app that shares the choice runs under, as `storyverse.fr`. Without it,
   * the choice stays with the current host.
   */
  domain?: string;
}

/**
 * Keeps the visitor's choice in a cookie for six months. A browser that refuses cookies forgets it
 * with the page, and the banner asks again on the next visit.
 */
export function saveTelemetryChoice(choice: TelemetryChoice, { domain }: SaveTelemetryChoiceOptions = {}): void {
  if (typeof document === "undefined") return;

  const attributes = [`Path=/`, `Max-Age=${CONSENT_LIFETIME_S}`, "SameSite=Lax"];
  if (domain) attributes.push(`Domain=${domain}`);
  if (location.protocol === "https:") attributes.push("Secure");

  document.cookie = [`${TELEMETRY_CONSENT_COOKIE}=${choice}`, ...attributes].join("; ");
}
