import { NextRequest, NextResponse } from "next/server";
import { backendUrl } from "@/lib/config";
import { COOKIE, extractRefresh } from "@/lib/session";

/**
 * BFF login: exchange credentials with the FastAPI backend server-side, then
 * store the backend access + refresh tokens in this origin's httpOnly cookies.
 * The browser never sees a token; every admin call goes through /api/backend/*.
 */
export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Email and password required",
        },
      },
      { status: 400 },
    );
  }

  const res = await fetch(backendUrl("/api/v1/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  const refresh = extractRefresh(res.headers.getSetCookie?.() ?? []);
  const out = NextResponse.json({ ok: true, user: data.user });
  const secure = process.env.NODE_ENV === "production";
  const base = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };

  out.cookies.set(COOKIE.access, data.access_token, {
    ...base,
    maxAge: 60 * 15,
  });
  if (refresh) {
    out.cookies.set(COOKIE.refresh, refresh, {
      ...base,
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  return out;
}
