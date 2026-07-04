import type { QueryClientConfig } from "@tanstack/react-query";

/**
 * MockQueryClient is a react-query configuration for tests: it disables retries and freezes the
 * stale time so background refetches never fire, leaving tests in full control of which queries run.
 */
export const MockQueryClient: QueryClientConfig = {
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
    },
  },
};

/** MockHeaders is the default JSON request header set for mocked HTTP responses. */
export const MockHeaders = { "Content-Type": "application/json" };
