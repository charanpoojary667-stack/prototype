import { cookies } from "next/headers";
import { demoFallbackResponse } from "../demo-fallback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };
const SESSION_COOKIE = "hackforge_session";
const demoMode = (process.env.VERCEL === "1" || process.env.HACKFORGE_DEMO_FALLBACK === "true") && !process.env.HACKFORGE_API_URL;

function apiBase() {
  const configured = process.env.HACKFORGE_API_URL?.trim();
  if (!configured) return `http://127.0.0.1:${process.env.API_PORT || "4000"}/api`;
  const url = new URL(configured);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("HACKFORGE_API_URL must be an HTTP(S) API origin or base path without credentials, query, or fragment.");
  }
  return url.toString().replace(/\/+$/, "").replace(/\/api$/i, "") + "/api";
}

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

  if (demoMode) return demoFallbackResponse(request, endpoint);

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (token) headers.set("authorization", `Bearer ${token}`);
  let base: string;
  try {
    base = `${apiBase()}/${endpoint}${new URL(request.url).search}`;
  } catch {
    return Response.json({ error: "The configured HackForge API URL is invalid." }, { status: 503 });
  }
  let upstream: Response | undefined;
  const maxAttempts = process.env.HACKFORGE_API_URL ? 2 : 8;
  const timeoutMs = process.env.HACKFORGE_API_URL ? 5_000 : 10_000;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      upstream = await fetch(base, {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.clone().arrayBuffer(),
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      break;
    } catch {
      if (attempt === maxAttempts - 1) {
        if (demoMode) return demoFallbackResponse(request, endpoint);
        return Response.json({ error: process.env.HACKFORGE_API_URL ? "The HackForge API service is unavailable. Check HACKFORGE_API_URL." : "The local application service is unavailable. Restart with npm run dev." }, { status: 503 });
      }
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
