/**
 * HTTP_HEADERS collects reusable request header presets. Each entry is a getter handing back a
 * fresh object, so callers may safely mutate what they receive.
 *
 * @deprecated A `RestClient` request sends a JSON body with its `Content-Type` through its
 *   `json` option. A request without a body sends no `Content-Type`.
 */
export const HTTP_HEADERS = {
  get JSON() {
    return { "Content-Type": "application/json" };
  },
};
