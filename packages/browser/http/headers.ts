/**
 * HTTP_HEADERS collects reusable request header presets. Each entry is a getter, so callers
 * receive a fresh object and cannot mutate the shared preset.
 */
export const HTTP_HEADERS = {
  get JSON() {
    return { "Content-Type": "application/json" };
  },
};
