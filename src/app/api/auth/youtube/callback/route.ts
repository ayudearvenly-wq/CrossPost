import { NextRequest, NextResponse } from "next/server";
import { getOAuth2Client } from "@/lib/youtube/auth";
import { getConnectedChannelInfo } from "@/lib/youtube/client";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/accounts?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/accounts?error=missing_authorization_code", request.url)
    );
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    if (!tokens.access_token) {
      throw new Error("No access token received from Google.");
    }

    // Retrieve YouTube channel details
    const channelInfo = await getConnectedChannelInfo(
      tokens.access_token,
      tokens.refresh_token || undefined
    );

    // Save tokens and channel metadata to Supabase connected_accounts table
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Upsert record into connected_accounts
      const { error: upsertErr } = await supabase.from("connected_accounts").upsert(
        {
          user_id: user.id,
          platform: "youtube",
          account_identifier: channelInfo.channelId,
          account_name: channelInfo.title,
          connection_status: "connected",
          encrypted_access_token: tokens.access_token,
          encrypted_refresh_token: tokens.refresh_token || null,
          token_expires_at: tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null,
          metadata: {
            customUrl: channelInfo.customUrl,
            thumbnailUrl: channelInfo.thumbnailUrl,
            subscriberCount: channelInfo.subscriberCount,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,platform" }
      );

      if (upsertErr) {
        console.error("Failed to save YouTube account to Supabase:", upsertErr);
      }
    }

    // Redirect user back to Connected Accounts with success confirmation
    return NextResponse.redirect(
      new URL(
        `/accounts?success=youtube_connected&channel=${encodeURIComponent(
          channelInfo.title || "YouTube Channel"
        )}`,
        request.url
      )
    );
  } catch (err: any) {
    console.error("YouTube OAuth callback error:", err);
    return NextResponse.redirect(
      new URL(`/accounts?error=${encodeURIComponent(err.message || "oauth_failed")}`, request.url)
    );
  }
}
