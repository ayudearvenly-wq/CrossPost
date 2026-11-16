import { NextRequest, NextResponse } from "next/server";
import { getYouTubeAuthUrl } from "@/lib/youtube/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user ? user.id : "guest";

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return NextResponse.json(
        {
          error: "Google OAuth credentials not configured.",
          message: "Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your .env.local file.",
        },
        { status: 400 }
      );
    }

    const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString("base64");
    const authUrl = getYouTubeAuthUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error("Failed to generate YouTube OAuth URL:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
