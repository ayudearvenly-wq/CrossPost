import { GRAPH_API_BASE, formatCaption } from "./auth";

export interface InstagramPublishParams {
  igUserId: string;
  accessToken: string;
  videoUrl: string;
  title: string;
  description: string;
  hashtags: string;
}

export interface InstagramPublishResult {
  creationId: string;
  mediaId: string;
  permalink?: string;
}

/**
 * Step 1: Create an Instagram Reels media container
 * POST /{ig-user-id}/media
 */
export async function createInstagramReelsContainer(params: InstagramPublishParams): Promise<string> {
  const caption = formatCaption(params.title, params.description, params.hashtags);

  const res = await fetch(`${GRAPH_API_BASE}/${params.igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "REELS",
      video_url: params.videoUrl,
      caption,
      share_to_feed: true,
      access_token: params.accessToken,
    }),
  });

  const data = await res.json();
  if (data.error) {
    if (data.error.code === 190) {
      throw new Error("Instagram access token has expired. Please re-authorize via Connected Accounts.");
    }
    if (data.error.code === 10 || data.error.code === 200) {
      throw new Error(`Instagram Permission Error: ${data.error.message}. Ensure your Instagram is a Creator/Business account.`);
    }
    throw new Error(`Instagram Container Creation Failed: ${data.error.message}`);
  }

  if (!data.id) {
    throw new Error("Instagram did not return a valid container ID.");
  }

  return data.id;
}

/**
 * Step 2: Poll container status until FINISHED
 * GET /{creation-id}?fields=status_code,status
 */
export async function checkInstagramContainerStatus(
  creationId: string,
  accessToken: string,
  maxAttempts: number = 30,
  intervalMs: number = 3000
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(
      `${GRAPH_API_BASE}/${creationId}?fields=status_code,status&access_token=${accessToken}`
    );
    const data = await res.json();

    if (data.error) {
      throw new Error(`Instagram status check failed: ${data.error.message}`);
    }

    const statusCode = data.status_code;

    if (statusCode === "FINISHED") {
      return; // Ready to be published
    }

    if (statusCode === "ERROR") {
      throw new Error(`Instagram video processing failed: ${data.status || "Video encoding error"}`);
    }

    if (statusCode === "EXPIRED") {
      throw new Error("Instagram media container expired before publishing.");
    }

    // Still IN_PROGRESS, wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Instagram video processing timed out. Please try again with a shorter or optimized video.");
}

/**
 * Step 3: Publish the container to Instagram Reels
 * POST /{ig-user-id}/media_publish
 */
export async function publishInstagramContainer(
  igUserId: string,
  creationId: string,
  accessToken: string
): Promise<string> {
  const res = await fetch(`${GRAPH_API_BASE}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: creationId,
      access_token: accessToken,
    }),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(`Instagram Media Publish Failed: ${data.error.message}`);
  }

  return data.id; // Published media ID
}

/**
 * Step 4: Retrieve published Reel permalink URL
 * GET /{media-id}?fields=permalink,shortcode
 */
export async function getInstagramMediaDetails(mediaId: string, accessToken: string) {
  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/${mediaId}?fields=permalink,shortcode,media_type&access_token=${accessToken}`
    );
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

/**
 * Full Instagram Reels publishing workflow
 */
export async function publishToInstagramReels(
  params: InstagramPublishParams
): Promise<InstagramPublishResult> {
  // 1. Create Media Container
  const creationId = await createInstagramReelsContainer(params);

  // 2. Wait for video processing
  await checkInstagramContainerStatus(creationId, params.accessToken);

  // 3. Publish container
  const mediaId = await publishInstagramContainer(params.igUserId, creationId, params.accessToken);

  // 4. Retrieve permalink
  const details = await getInstagramMediaDetails(mediaId, params.accessToken);

  return {
    creationId,
    mediaId,
    permalink: details?.permalink || `https://www.instagram.com/reel/${details?.shortcode || mediaId}`,
  };
}
