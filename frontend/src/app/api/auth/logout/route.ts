import { NextRequest, NextResponse } from "next/server";
import { backendUrl } from "@/lib/config";
import { COOKIE } from "@/lib/session";

/** BFF logout: revoke the refresh token on the backend, then clear cookies. */
export async function POST(req: NextRequest) {
  const refresh = req.cookies.get(COOKIE.refresh)?.value;
  if (refresh) {
    await fetch(backendUrl("/api/v1/auth/logout"), {
      method: "POST",
      headers: { Cookie: `pje_refresh=${refresh}` },
    }).catch(() => null);
  }

  const out = NextResponse.json({ ok: true });
  for (const name of Object.values(COOKIE)) {
    out.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return out;
}
