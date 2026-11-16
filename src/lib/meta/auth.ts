/**
 * Meta Graph API OAuth & Client Configuration
 * Current API Version: v21.0
 */

const META_APP_ID = process.env.META_APP_ID || "";
const META_APP_SECRET = process.env.META_APP_SECRET || "";
const META_REDIRECT_URI =
  process.env.META_REDIRECT_URI || "http://localhost:3000/api/auth/meta/callback";
export const GRAPH_API_VERSION = "v21.0";
export const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Required permissions for Instagram Reels (Creator) and Facebook Reels (Page)
 */
export const META_SCOPES = [
  "public_profile",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
];

/**
 * Formats video caption uniformly across Instagram & Facebook:
 * Title
 *
 * Description
 *
 * Hashtags
 */
export function formatCaption(title: string, description: string, hashtags: string): string {
  const parts: string[] = [];
  if (title.trim()) parts.push(title.trim());
  if (description.trim()) parts.push(description.trim());
  if (hashtags.trim()) parts.push(hashtags.trim());

  return parts.join("\n\n");
}

/**
 * Generates official Meta OAuth dialog URL
 */
export function getMetaAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: META_REDIRECT_URI,
    state,
    scope: META_SCOPES.join(","),
    response_type: "code",
  });

  return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}

/**
 * Exchanges OAuth authorization code for a short-lived user access token
 */
export async function exchangeCodeForToken(code: string) {
  const url = `${GRAPH_API_BASE}/oauth/access_token?` + new URLSearchParams({
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    redirect_uri: META_REDIRECT_URI,
    code,
  });

  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    throw new Error(`Meta Token Exchange Error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  return data; // { access_token, token_type, expires_in }
}

/**
 * Exchanges short-lived user token for a 60-day long-lived user token
 */
export async function getLongLivedUserToken(shortLivedToken: string) {
  const url = `${GRAPH_API_BASE}/oauth/access_token?` + new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    fb_exchange_token: shortLivedToken,
  });

  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    throw new Error(`Meta Long-Lived Token Error: ${data.error.message}`);
  }

  return data; // { access_token, token_type, expires_in }
}

/**
 * Retrieves Facebook Pages managed by user, their Page Access Tokens,
 * and any connected Instagram Creator/Business account.
 */
export async function getPagesAndInstagramAccounts(userAccessToken: string) {
  // Query /me/accounts with instagram_business_account field
  const url = `${GRAPH_API_BASE}/me/accounts?` + new URLSearchParams({
    fields: "id,name,access_token,category,tasks,instagram_business_account{id,username,name,profile_picture_url}",
    access_token: userAccessToken,
  });

  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    throw new Error(`Meta Pages Fetch Error: ${data.error.message}`);
  }

  const pages = data.data || [];
  return pages;
}
