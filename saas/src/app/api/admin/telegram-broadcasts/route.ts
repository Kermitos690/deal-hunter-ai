import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, isAdmin, jsonError } from "@/lib/api";
import {
  createBroadcast,
  ensureReleaseBroadcast,
  listBroadcasts,
  type BroadcastAudience
} from "@/telegram/broadcast";

const createSchema = z.object({
  template: z.literal("release").optional(),
  title: z.string().trim().min(3).max(100).optional(),
  content_html: z.string().trim().min(10).max(3900).optional(),
  audience: z.enum(["all_started", "active_free", "active_paid"]).default("all_started"),
  button_label: z.string().trim().max(40).nullable().optional(),
  button_url: z.string().url().refine((value) => value.startsWith("https://"), "URL HTTPS requise.").nullable().optional()
}).refine((value) => value.template === "release" || Boolean(value.title && value.content_html), {
  message: "Titre et message requis."
});

export async function GET() {
  const auth = await apiUser();
  if ("response" in auth) return auth.response;
  if (!isAdmin(auth.user)) return jsonError("Accès administrateur requis.", 403);
  return NextResponse.json({ broadcasts: await listBroadcasts() });
}

export async function POST(request: Request) {
  const auth = await apiUser();
  if ("response" in auth) return auth.response;
  if (!isAdmin(auth.user)) return jsonError("Accès administrateur requis.", 403);
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Diffusion invalide.", 422, parsed.error.flatten());

  try {
    const broadcast = parsed.data.template === "release"
      ? await ensureReleaseBroadcast(auth.user.id)
      : await createBroadcast({
          actorUserId: auth.user.id,
          title: parsed.data.title!,
          contentHtml: parsed.data.content_html!,
          audience: parsed.data.audience as BroadcastAudience,
          buttonLabel: parsed.data.button_label,
          buttonUrl: parsed.data.button_url
        });
    return NextResponse.json({ broadcast }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Création impossible.", 500);
  }
}
