import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthUrl } from "@/lib/meta/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user ? user.id : "guest";

    if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
      return NextResponse.json(
        {
          error: "Meta App credentials not configured.",
          message: "Please add META_APP_ID and META_APP_SECRET to your .env.local file.",
        },
        { status: 400 }
      );
    }

    const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString("base64");
    const authUrl = getMetaAuthUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error("Failed to generate Meta OAuth URL:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
