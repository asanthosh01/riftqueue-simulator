export const PRIVATE_NO_STORE = "private, no-store";

export function privateJson(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: {
      "cache-control": PRIVATE_NO_STORE,
      ...init?.headers,
    },
  });
}
