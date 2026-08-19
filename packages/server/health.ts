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

/** HealthService selects one configured endpoint from the platform service registry. */
export interface HealthService {
  /** The absolute URL of the service health endpoint. */
  url: string | URL;
}

/** HealthServiceRegistry names every downstream whose readiness the platform reports. */
export type HealthServiceRegistry = Readonly<Record<string, HealthService>>;

/** HealthServiceConfig resolves one service endpoint and its request deadline inside the health boundary. */
export interface HealthServiceConfig extends HealthService {
  /** The deadline applied to this service request. */
  timeoutMs: number;
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

/** AggregateHealthOptions supplies an already-resolved registry and request boundary. */
export interface AggregateHealthOptions<Registry extends HealthServiceRegistry> {
  /** The fetch implementation used by the host framework. */
  fetch: typeof globalThis.fetch;
  /** The configured endpoints to probe in parallel. */
  services: Registry;
  /** The deadline applied independently to each request. */
  timeoutMs: number;
}

/** AggregateHealthConfigOptions keeps private configuration resolution inside the health boundary. */
export interface AggregateHealthConfigOptions<Config extends HealthConfig> {
  /** Stable service names with lazy endpoint configuration. */
  config: Config;
  /** The fetch implementation used by the host framework. */
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
  service: HealthService,
  timeoutMs: number
): Promise<ServiceHealth> {
  try {
    const response = await fetchImplementation(new URL(service.url), {
      headers: {
        accept: "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { status: "down" };

    const dependencies = readDependencies(await response.json());
    return dependencies ? { status: "up", dependencies } : { status: "down" };
  } catch {
    return { status: "down" };
  }
}

function isReady(service: ServiceHealth): boolean {
  return service.status === "up" && Object.values(service.dependencies).every(({ status }) => status === "up");
}

function result<Registry extends Readonly<Record<string, unknown>>>(
  services: AggregatedHealth<Registry>["services"]
): AggregatedHealth<Registry> {
  return {
    services,
    status: Object.values<ServiceHealth>(services).every(isReady) ? "up" : "down",
  };
}

/** Probes configured services and converts private configuration failures into stable down results. */
export function aggregateHealth<const Config extends HealthConfig>(
  options: AggregateHealthConfigOptions<Config>
): Promise<AggregatedHealth<Config>>;
/** Probes an already-resolved service registry in parallel. */
export function aggregateHealth<const Registry extends HealthServiceRegistry>(
  options: AggregateHealthOptions<Registry>
): Promise<AggregatedHealth<Registry>>;
export async function aggregateHealth(
  options: AggregateHealthConfigOptions<HealthConfig> | AggregateHealthOptions<HealthServiceRegistry>
): Promise<AggregatedHealth<Readonly<Record<string, unknown>>>> {
  if ("config" in options) {
    const names = Object.keys(options.config);

    try {
      const configured = Object.fromEntries(
        Object.entries(options.config).map(([name, configure]) => [name, configure()] as const)
      );
      for (const service of Object.values(configured)) assertTimeout(service.timeoutMs);

      const entries = await Promise.all(
        Object.entries(configured).map(
          async ([name, service]) => [name, await probeService(options.fetch, service, service.timeoutMs)] as const
        )
      );

      return result(Object.fromEntries(entries));
    } catch {
      return result(Object.fromEntries(names.map((name) => [name, { status: "down" }] as const)));
    }
  }

  assertTimeout(options.timeoutMs);
  const entries = await Promise.all(
    Object.entries(options.services).map(
      async ([name, service]) => [name, await probeService(options.fetch, service, options.timeoutMs)] as const
    )
  );

  return result(Object.fromEntries(entries));
}
