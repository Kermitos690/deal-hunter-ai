import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { runRadarScan } from "@/lib/scans/run-radar-scan";

type Context = { params: Promise<{ id: string }> };
export async function POST(_: Request, { params }: Context) {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  try {
    return NextResponse.json(await runRadarScan((await params).id, auth.user.id));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Scan impossible.", 400);
  }
}
