import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, getLongLivedUserToken, getPagesAndInstagramAccounts } from "@/lib/meta/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      new URL(`/accounts?error=${encodeURIComponent(errorDescription || error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/accounts?error=missing_meta_authorization_code", request.url)
    );
  }

  try {
    // 1. Exchange code for short-lived token
    const tokenData = await exchangeCodeForToken(code);

    // 2. Exchange for 60-day long-lived token
    const longLived = await getLongLivedUserToken(tokenData.access_token);
    const userAccessToken = longLived.access_token;
    const expiresInSeconds = longLived.expires_in || 5184000; // ~60 days
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    // 3. Retrieve Facebook Pages and connected Instagram accounts
    const pages = await getPagesAndInstagramAccounts(userAccessToken);

    if (pages.length === 0) {
      return NextResponse.redirect(
        new URL("/accounts?error=no_facebook_pages_found&details=Please+ensure+you+manage+at+least+one+Facebook+Page.", request.url)
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Select the first managed page
    const selectedPage = pages[0];
    const pageId = selectedPage.id;
    const pageName = selectedPage.name;
    const pageAccessToken = selectedPage.access_token; // Page Access Token

    // Save Facebook Page to connected_accounts
    await supabase.from("connected_accounts").upsert(
      {
        user_id: user.id,
        platform: "facebook",
        account_identifier: pageId,
        account_name: pageName,
        connection_status: "connected",
        encrypted_access_token: pageAccessToken,
        encrypted_refresh_token: userAccessToken,
        token_expires_at: expiresAt,
        metadata: {
          category: selectedPage.category,
          allPagesCount: pages.length,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" }
    );

    let igConnected = false;
    let igUsername = "";

    // Check if Instagram Creator/Business account is connected to this Page
    if (selectedPage.instagram_business_account) {
      const ig = selectedPage.instagram_business_account;
      igConnected = true;
      igUsername = ig.username || ig.name || "Instagram Account";

      // Save Instagram to connected_accounts
      await supabase.from("connected_accounts").upsert(
        {
          user_id: user.id,
          platform: "instagram",
          account_identifier: ig.id,
          account_name: igUsername,
          connection_status: "connected",
          encrypted_access_token: pageAccessToken, // Page Token authorizes connected IG
          encrypted_refresh_token: userAccessToken,
          token_expires_at: expiresAt,
          metadata: {
            profilePictureUrl: ig.profile_picture_url,
            linkedPageId: pageId,
            linkedPageName: pageName,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,platform" }
      );
    }

    const message = igConnected
      ? `meta_connected&facebook=${encodeURIComponent(pageName)}&instagram=${encodeURIComponent(igUsername)}`
      : `meta_connected&facebook=${encodeURIComponent(pageName)}&ig_notice=No+Instagram+Creator+account+linked+to+this+Facebook+Page`;

    return NextResponse.redirect(new URL(`/accounts?success=${message}`, request.url));
  } catch (err: any) {
    console.error("Meta OAuth Callback Error:", err);
    return NextResponse.redirect(
      new URL(`/accounts?error=${encodeURIComponent(err.message || "meta_auth_failed")}`, request.url)
    );
  }
}
