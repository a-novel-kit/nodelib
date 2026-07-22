import { vi } from "vitest";

const mergeKeyAndNs = (key: string, ns?: string | null) => (ns ? `${ns}:${key}` : key);

/**
 * tolgeeMock builds a vitest module-mock factory for the Tolgee React bindings. The translation
 * hooks and components become stand-ins that echo the namespaced key, so tests assert on stable
 * strings. Pass the module's importOriginal so untouched exports pass through.
 */
export const tolgeeMock = async (importOriginal: () => any) => {
  const original = await importOriginal();

  return {
    ...(original as any),
    useTranslate: vi.fn().mockImplementation(() => ({
      t: (key: string, data: { ns: string }) => JSON.stringify({ key: mergeKeyAndNs(key, data.ns), data }),
    })),
    T: ({ keyName, ns }: { keyName: string; ns: string; params: any }) =>
      JSON.stringify({ key: mergeKeyAndNs(keyName, ns) }),
    useTolgee: vi.fn().mockImplementation(() => ({
      addActiveNs: vi.fn().mockImplementation(() => Promise.resolve()),
      removeActiveNs: vi.fn(),
      getLanguage: vi.fn().mockImplementation(() => "en"),
      getPendingLanguage: vi.fn().mockImplementation(() => "en"),
    })),
  };
};
