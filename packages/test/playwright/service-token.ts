import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/** The stack's local issuer, which signs a service token for any caller who asks. */
const issuer = "http://127.0.0.1:14101/token";

/** Draws a service token for `subject`, a caller's Kubernetes service account, from the local issuer. */
export async function serviceToken(subject: string, audience = "authentication"): Promise<string> {
  const response = await fetch(`${issuer}?${new URLSearchParams({ subject, audience })}`);
  if (!response.ok) throw new Error(`The service-token issuer answered ${response.status}: ${await response.text()}`);
  return await response.text();
}

/** Wraps `fetch` so every request proves `subject`'s identity, as a platform's own calls do. */
export function callerFetch(subject: string, audience = "authentication"): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("X-Service-Authorization", await serviceToken(subject, audience));
    return await fetch(input, { ...init, headers });
  };
}

/** A service token file a platform server under test reads, as a pod reads its projected token. */
export interface ServiceTokenFile {
  /** The file the server reads its token from. */
  path: string;
  /** The caller the token proves, as `system:serviceaccount:studio:web`. */
  subject: string;
  /**
   * The service the token is for.
   * @default "authentication"
   */
  audience?: string;
}

/** Builds a Playwright global setup that writes each token file, and removes them on teardown. */
export function serviceTokenSetup(files: ServiceTokenFile[]) {
  return async function setup(): Promise<() => Promise<void>> {
    for (const { path, subject, audience } of files) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, await serviceToken(subject, audience));
    }

    return async () => {
      await Promise.all(files.map(({ path }) => rm(path, { force: true })));
    };
  };
}
