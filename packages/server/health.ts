/** HealthStatus is the shared up/down vocabulary exposed by service health endpoints. */
export type HealthStatus = "down" | "up";

/** HealthDependency preserves one downstream dependency entry reported by a service. */
export interface HealthDependency {
  /** The service-defined reachability of this dependency. */
  status: HealthStatus;
  /** Additional service-owned diagnostic fields pass through unchanged. */
  [key: string]: unknown;
}

/** HealthDependencies is the unmodified dependency map returned by one service. */
export type HealthDependencies = Record<string, HealthDependency>;

/** HealthServiceConfig resolves one service endpoint and its request deadline inside the health boundary. */
export interface HealthServiceConfig {
  /** The absolute URL of the service health endpoint. */
  url: string | URL;
  /** The deadline applied to this service request. */
  timeoutMs: number;
  /** Sends this probe in place of the shared `fetch`, as a service that requires the platform's token does. */
  fetch?: typeof globalThis.fetch;
}

/** HealthConfig names every downstream before resolving private runtime configuration. */
export type HealthConfig = Readonly<Record<string, () => HealthServiceConfig>>;

/** ServiceHealth separates endpoint reachability from the dependency statuses in its response. */
export type ServiceHealth =
  | { status: "down" }
  | {
      status: "up";
      dependencies: HealthDependencies;
    };

/** AggregatedHealth reports platform readiness while retaining each registered service result. */
export interface AggregatedHealth<Registry extends Readonly<Record<string, unknown>>> {
  /** The platform is up only when every endpoint and every reported dependency is up. */
  status: HealthStatus;
  /** Results retain the service names declared by the caller. */
  services: { [Name in keyof Registry]: ServiceHealth };
}

/** AggregateHealthConfigOptions keeps private configuration resolution inside the health boundary. */
export interface AggregateHealthConfigOptions<Config extends HealthConfig> {
  /** Stable service names with lazy endpoint configuration. */
  config: Config;
  /** The fetch implementation used by the host framework, for every probe without its own. */
  fetch: typeof globalThis.fetch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readDependencies(value: unknown): HealthDependencies | null {
  if (!isRecord(value)) return null;

  for (const dependency of Object.values(value)) {
    if (!isRecord(dependency) || (dependency.status !== "down" && dependency.status !== "up")) return null;
  }

  return value as HealthDependencies;
}

function assertTimeout(timeoutMs: number): void {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("timeoutMs must be a positive safe integer");
  }
}

async function probeService(
  fetchImplementation: typeof globalThis.fetch,
  service: HealthServiceConfig
): Promise<ServiceHealth> {
  try {
    const response = await fetchImplementation(new URL(service.url), {
      headers: {
        accept: "application/json",
      },
      signal: AbortSignal.timeout(service.timeoutMs),
    });
    if (!response.ok) {
      // An unread body holds its connection until the deadline aborts it.
      await response.body?.cancel();
      return { status: "down" };
    }

    const dependencies = readDependencies(await response.json());
    return dependencies ? { status: "up", dependencies } : { status: "down" };
  } catch {
    return { status: "down" };
  }
}

function isReady(service: ServiceHealth): boolean {
  return service.status === "up" && Object.values(service.dependencies).every(({ status }) => status === "up");
}

function result<Config extends HealthConfig>(services: Record<string, ServiceHealth>): AggregatedHealth<Config> {
  return {
    services: services as AggregatedHealth<Config>["services"],
    status: Object.values(services).every(isReady) ? "up" : "down",
  };
}

/** Resolves each service's configuration, or returns null when any of them fails. */
function resolveConfig(config: HealthConfig): [string, HealthServiceConfig][] | null {
  try {
    const services = Object.entries(config).map(
      ([name, resolve]) => [name, resolve()] as [string, HealthServiceConfig]
    );
    for (const [, service] of services) assertTimeout(service.timeoutMs);
    return services;
  } catch {
    return null;
  }
}

/**
 * Probes every configured service in parallel, each within its own deadline. A configuration that
 * fails reports every service down, so no private detail reaches the response.
 */
export async function aggregateHealth<const Config extends HealthConfig>({
  config,
  fetch,
}: AggregateHealthConfigOptions<Config>): Promise<AggregatedHealth<Config>> {
  const services = resolveConfig(config);
  if (!services) {
    return result(Object.fromEntries(Object.keys(config).map((name) => [name, { status: "down" }])));
  }

  const probes = services.map(async ([name, service]) => [name, await probeService(service.fetch ?? fetch, service)]);
  return result(Object.fromEntries(await Promise.all(probes)));
}
