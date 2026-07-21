import { NextResponse } from "next/server";

const isProd = process.env.NODE_ENV === "production";

export async function POST(req: Request) {
  const { dashboard_token } = await req.json();
  if (!dashboard_token || typeof dashboard_token !== "string") {
    return NextResponse.json({ error: "Missing dashboard_token" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("dashboard_token", dashboard_token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("dashboard_token");
  return res;
}
