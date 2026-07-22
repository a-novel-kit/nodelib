/**
 * HTTP_HEADERS collects reusable request header presets. Each entry is a getter handing back a
 * fresh object, so callers may safely mutate what they receive.
 */
export const HTTP_HEADERS = {
  get JSON() {
    return { "Content-Type": "application/json" };
  },
};
