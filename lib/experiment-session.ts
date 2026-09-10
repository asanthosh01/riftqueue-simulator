const SESSION_COOKIE_NAME = "riftqueue_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const sessionTokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type VisitorSession = {
  token: string;
  setCookie?: string;
};

function sessionTokenFromCookie(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const value = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);
  return value && sessionTokenPattern.test(value) ? value : null;
}

function sessionCookie(token: string, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

export function existingVisitorSession(request: Request) {
  return sessionTokenFromCookie(request);
}

export function visitorSession(request: Request): VisitorSession {
  const existing = sessionTokenFromCookie(request);
  if (existing) return { token: existing };

  const token = crypto.randomUUID();
  return { token, setCookie: sessionCookie(token, request) };
}

export async function experimentOwnerKey(secret: string, sessionToken: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`owner:${sessionToken}`),
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
