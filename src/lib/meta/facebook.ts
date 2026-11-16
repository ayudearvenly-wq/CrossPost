import { GRAPH_API_BASE, formatCaption } from "./auth";

export interface FacebookPublishParams {
  pageId: string;
  pageAccessToken: string;
  videoUrl: string;
  title: string;
  description: string;
  hashtags: string;
}

export interface FacebookPublishResult {
  videoId: string;
  permalinkUrl?: string;
}

/**
 * Step 1: Initialize an upload session for Facebook Reels
 * POST /{page-id}/video_reels
 */
export async function initFacebookReelsUpload(
  pageId: string,
  pageAccessToken: string
): Promise<{ videoId: string; uploadUrl: string }> {
  const res = await fetch(`${GRAPH_API_BASE}/${pageId}/video_reels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      upload_phase: "start",
      access_token: pageAccessToken,
    }),
  });

  const data = await res.json();
  if (data.error) {
    if (data.error.code === 190) {
      throw new Error("Facebook Page access token expired. Please re-authorize on Connected Accounts.");
    }
    throw new Error(`Facebook Reels Session Init Failed: ${data.error.message}`);
  }

  if (!data.video_id || !data.upload_url) {
    throw new Error("Facebook did not return video_id or upload_url for Reels.");
  }

  return {
    videoId: data.video_id,
    uploadUrl: data.upload_url,
  };
}

/**
 * Step 2: Transfer video payload into Facebook's rupload endpoint
 * POST {upload_url} with file binary or file_url
 */
export async function uploadFacebookReelsMedia(
  uploadUrl: string,
  pageAccessToken: string,
  videoUrl: string
): Promise<void> {
  // Transfer media from hosted videoUrl
  const videoFetchRes = await fetch(videoUrl);
  if (!videoFetchRes.ok) {
    throw new Error("Failed to read video file from storage to upload to Facebook.");
  }
  const videoBuffer = await videoFetchRes.arrayBuffer();

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${pageAccessToken}`,
      offset: "0",
      file_size: videoBuffer.byteLength.toString(),
      "Content-Type": "application/octet-stream",
    },
    body: videoBuffer,
  });

  const uploadData = await uploadRes.json();
  if (uploadData.error) {
    throw new Error(`Facebook Reels Binary Transfer Failed: ${uploadData.error.message}`);
  }
}

/**
 * Step 3: Finish and Publish Facebook Reel
 * POST /{page-id}/video_reels (upload_phase=finish)
 */
export async function finishAndPublishFacebookReels(
  pageId: string,
  pageAccessToken: string,
  videoId: string,
  caption: string
): Promise<void> {
  const res = await fetch(`${GRAPH_API_BASE}/${pageId}/video_reels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      upload_phase: "finish",
      access_token: pageAccessToken,
      video_id: videoId,
      video_state: "PUBLISHED",
      description: caption,
    }),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(`Facebook Reels Publishing Failed: ${data.error.message}`);
  }
}

/**
 * Step 4: Check Facebook video processing status
 * GET /{video-id}?fields=status
 */
export async function checkFacebookReelsStatus(
  videoId: string,
  pageAccessToken: string,
  maxAttempts: number = 20,
  intervalMs: number = 3000
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(
      `${GRAPH_API_BASE}/${videoId}?fields=status,permalink_url&access_token=${pageAccessToken}`
    );
    const data = await res.json();

    if (data.error) {
      throw new Error(`Facebook video status check failed: ${data.error.message}`);
    }

    const videoStatus = data.status?.video_status;
    if (videoStatus === "ready" || videoStatus === "published" || !videoStatus) {
      return; // Ready/done
    }

    if (videoStatus === "error") {
      throw new Error("Facebook reported a video encoding/processing error.");
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/**
 * Full Facebook Reels publishing workflow
 */
export async function publishToFacebookReels(
  params: FacebookPublishParams
): Promise<FacebookPublishResult> {
  const caption = formatCaption(params.title, params.description, params.hashtags);

  // 1. Initialize upload session
  const { videoId, uploadUrl } = await initFacebookReelsUpload(
    params.pageId,
    params.pageAccessToken
  );

  // 2. Upload video binary
  await uploadFacebookReelsMedia(uploadUrl, params.pageAccessToken, params.videoUrl);

  // 3. Finish and publish with uniform caption
  await finishAndPublishFacebookReels(params.pageId, params.pageAccessToken, videoId, caption);

  // 4. Verify processing status
  await checkFacebookReelsStatus(videoId, params.pageAccessToken);

  return {
    videoId,
    permalinkUrl: `https://www.facebook.com/reel/${videoId}`,
  };
}
