import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { platform } = await request.json();
    if (!platform || !["youtube", "instagram", "facebook"].includes(platform)) {
      return NextResponse.json({ error: "Invalid platform specified." }, { status: 400 });
    }

    // Delete or update the record to disconnected
    const { error: dbErr } = await supabase
      .from("connected_accounts")
      .delete()
      .eq("user_id", user.id)
      .eq("platform", platform);

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Disconnected ${platform} successfully.`,
      platform,
    });
  } catch (error: any) {
    console.error("Disconnect error:", error);
    return NextResponse.json({ error: error?.message || "Failed to disconnect account." }, { status: 500 });
  }
}
