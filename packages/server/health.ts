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

/** ServiceHealth separates endpoint reachability from the dependency statuses in its response. */
export type ServiceHealth =
  | { status: "down" }
  | {
      status: "up";
      dependencies: HealthDependencies;
    };

/** AggregatedHealth reports platform readiness while retaining each registered service result. */
export interface AggregatedHealth<Registry extends HealthServiceRegistry> {
  /** The platform is up only when every endpoint and every reported dependency is up. */
  status: HealthStatus;
  /** Results retain the service names declared by the caller. */
  services: { [Name in keyof Registry]: ServiceHealth };
}

/** AggregateHealthOptions supplies the caller-owned registry and request boundary. */
export interface AggregateHealthOptions<Registry extends HealthServiceRegistry> {
  /** The fetch implementation used by the host framework. */
  fetch: typeof globalThis.fetch;
  /** The configured endpoints to probe in parallel. */
  services: Registry;
  /** The deadline applied independently to each request. */
  timeoutMs: number;
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

/** Probes configured services in parallel and proxies valid dependency maps without fabricating failures. */
export async function aggregateHealth<const Registry extends HealthServiceRegistry>(
  options: AggregateHealthOptions<Registry>
): Promise<AggregatedHealth<Registry>> {
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new RangeError("timeoutMs must be a positive safe integer");
  }

  const entries = await Promise.all(
    Object.entries(options.services).map(
      async ([name, service]) => [name, await probeService(options.fetch, service, options.timeoutMs)] as const
    )
  );
  const services = Object.fromEntries(entries) as AggregatedHealth<Registry>["services"];

  return {
    services,
    status: Object.values<ServiceHealth>(services).every(isReady) ? "up" : "down",
  };
}
