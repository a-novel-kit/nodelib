import { isHttpStatusError } from "@a-novel-kit/nodelib-browser/http";

function prettyRes(res: any): string {
  try {
    return JSON.stringify(res, null, 2);
  } catch {
    return `${res?.toString?.()}`;
  }
}

export async function expectStatus(callback: Promise<any>, status: number) {
  const res = await callback.catch((err) => err);

  if (!isHttpStatusError(res, status)) {
    throw new Error(`expected error with status ${status}, got: ${prettyRes(res)}`);
  }
}
