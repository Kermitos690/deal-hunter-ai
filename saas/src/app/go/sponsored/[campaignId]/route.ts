import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/security/session";
import { recordSponsoredClick } from "@/lib/channels/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ campaignId: string }> }
) {
  const user = await currentUser();
  const { campaignId } = await context.params;
  const channelId = request.nextUrl.searchParams.get("channel") ?? "";
  if (!user || !UUID.test(campaignId) || !UUID.test(channelId)) {
    return NextResponse.redirect(new URL("/dashboard/channels", request.url));
  }
  try {
    const destination = await recordSponsoredClick(user.id, campaignId, channelId);
    return NextResponse.redirect(destination ?? new URL("/dashboard/channels", request.url));
  } catch (error) {
    console.error("Sponsored click redirect failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.redirect(new URL("/dashboard/channels", request.url));
  }
}
