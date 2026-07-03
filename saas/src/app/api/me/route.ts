import { NextResponse } from "next/server";
import { apiUser } from "@/lib/api";

export async function GET() {
  const auth = await apiUser();
  if ("response" in auth) return auth.response;
  return NextResponse.json({ user: auth.user });
}
