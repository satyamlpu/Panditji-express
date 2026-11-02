import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { REVALIDATE_SECRET } from "@/lib/config";

/**
 * On-demand ISR revalidation webhook. The backend calls this (with the shared
 * secret) after publishing content, so the affected public pages re-render on
 * the next request — no redeploy needed. Guarded by a secret header; the tag
 * list it accepts cannot leak data, only trigger a re-render.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-revalidate-secret");
  if (!secret || secret !== REVALIDATE_SECRET) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "Invalid secret" } },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const tags: string[] = Array.isArray(body?.tags) ? body.tags : [];
  for (const tag of tags) {
    if (typeof tag === "string" && tag.length <= 120) revalidateTag(tag);
  }

  return NextResponse.json({ revalidated: true, tags });
}
