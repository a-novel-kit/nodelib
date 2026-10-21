/**
 * Takes the network away from the tests this file sets up. The global `fetch` rejects every request
 * a test does not stub, so no test reaches a live service. `vi.stubGlobal("fetch", …)` answers a
 * request, and `vi.unstubAllGlobals()` restores the rejection.
 */
globalThis.fetch = (input) => {
  const url = input instanceof Request ? input.url : String(input);
  return Promise.reject(new Error(`tests have no network: stub fetch to answer ${url}`));
};
