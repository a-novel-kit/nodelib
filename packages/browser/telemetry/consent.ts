import { z } from "zod";

/** TelemetryChoice is the visitor's answer to the telemetry consent banner. */
export type TelemetryChoice = z.infer<typeof TelemetryChoiceSchema>;

const TelemetryChoiceSchema = z.enum(["accepted", "declined"]);

// A new version asks every visitor again. Raise it when telemetry starts collecting something the
// banner does not describe.
const CONSENT_VERSION = 1;

// The CNIL asks to renew a choice after six months, whatever the answer.
const CONSENT_LIFETIME_MS = 182 * 24 * 60 * 60 * 1000;

const STORAGE_KEY = "telemetry-consent";

const StoredConsentSchema = z.object({
  version: z.literal(CONSENT_VERSION),
  choice: TelemetryChoiceSchema,
  expires: z.number(),
});

/**
 * Reads the visitor's choice from this device. It returns undefined when the visitor must choose:
 * they never answered, answered an older version of the banner, answered more than six months ago,
 * or the device keeps no storage, as on the server.
 */
export function readTelemetryChoice(now = Date.now()): TelemetryChoice | undefined {
  const stored = StoredConsentSchema.safeParse(parseJSON(deviceStorage()?.getItem(STORAGE_KEY))).data;
  return stored && stored.expires > now ? stored.choice : undefined;
}

/**
 * Keeps the visitor's choice on this device for six months. A device that refuses storage forgets
 * it with the page, and the banner asks again on the next visit.
 */
export function saveTelemetryChoice(choice: TelemetryChoice, now = Date.now()): void {
  const stored: z.infer<typeof StoredConsentSchema> = {
    version: CONSENT_VERSION,
    choice,
    expires: now + CONSENT_LIFETIME_MS,
  };

  try {
    deviceStorage()?.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // A full or disabled storage leaves the choice to this page view.
  }
}

// Browsers throw on access to localStorage when the visitor blocks site data.
function deviceStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function parseJSON(raw: string | null | undefined): unknown {
  try {
    return JSON.parse(raw ?? "null");
  } catch {
    return undefined;
  }
}
