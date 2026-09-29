import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };
const SESSION_COOKIE = "hackforge_session";

function secureCookie(request: Request) {
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  return process.env.NODE_ENV === "production" && (forwardedProtocol === "https" || new URL(request.url).protocol === "https:");
}

async function forward(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const endpoint = path.join("/");
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const isLogout = endpoint === "auth/logout" && request.method === "POST";

  if (isLogout) {
    const response = Response.json({ ok: true });
    response.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie(request) ? "; Secure" : ""}`);
    return response;
  }

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (token) headers.set("authorization", `Bearer ${token}`);
  const base = `http://127.0.0.1:${process.env.API_PORT || "4000"}/api/${endpoint}${new URL(request.url).search}`;
  let upstream: Response | undefined;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      upstream = await fetch(base, {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.clone().arrayBuffer(),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      break;
    } catch {
      if (attempt === 7) return Response.json({ error: "The local application service is unavailable. Restart with npm run dev." }, { status: 503 });
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  if (!upstream) return Response.json({ error: "The local application service is unavailable." }, { status: 503 });
  const responseHeaders = new Headers({
    "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
    "cache-control": "no-store",
  });

  if ((endpoint === "auth/login" || endpoint === "auth/signup" || endpoint === "auth/register") && upstream.ok) {
    const result = await upstream.json() as { token?: string; user?: unknown };
    if (result.token) {
      responseHeaders.append("Set-Cookie", `${SESSION_COOKIE}=${result.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secureCookie(request) ? "; Secure" : ""}`);
      return new Response(JSON.stringify({ user: result.user }), { status: upstream.status, headers: responseHeaders });
    }
    return Response.json(result, { status: upstream.status, headers: responseHeaders });
  }

  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
