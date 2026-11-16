import { google } from "googleapis";
import { Readable } from "stream";
import { getOAuth2Client } from "./auth";

export interface YouTubeUploadParams {
  accessToken: string;
  refreshToken?: string;
  title: string;
  description: string;
  tags?: string[];
  privacyStatus?: "public" | "unlisted" | "private";
  videoStream: Readable;
}

export interface YouTubeUploadResult {
  videoId: string;
  videoUrl: string;
  title: string;
  privacyStatus: string;
}

/**
 * Uploads a video to YouTube using the official YouTube Data API v3 (videos.insert)
 * Supports resumable media uploads for maximum reliability with short-form videos.
 */
export async function uploadVideoToYouTube(
  params: YouTubeUploadParams
): Promise<YouTubeUploadResult> {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: params.accessToken,
    refresh_token: params.refreshToken,
  });

  const youtube = google.youtube({
    version: "v3",
    auth: oauth2Client,
  });

  try {
    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: params.title,
          description: params.description,
          tags: params.tags || [],
          categoryId: "22", // People & Blogs (standard category)
        },
        status: {
          privacyStatus: params.privacyStatus || "private",
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: params.videoStream,
      },
    });

    const videoId = response.data.id;
    if (!videoId) {
      throw new Error("YouTube did not return a valid video ID.");
    }

    return {
      videoId,
      videoUrl: `https://youtube.com/shorts/${videoId}`,
      title: response.data.snippet?.title || params.title,
      privacyStatus: response.data.status?.privacyStatus || params.privacyStatus || "private",
    };
  } catch (error: any) {
    // Inspect specific Google API errors (quotas, permissions, token expirations)
    if (error?.code === 403) {
      const reason = error?.errors?.[0]?.reason;
      if (reason === "quotaExceeded") {
        throw new Error(
          "YouTube API Quota exceeded. YouTube Data API v3 enforces a default daily limit of 10,000 units (video upload consumes 1,600 units). Request a quota increase in Google Cloud Console."
        );
      }
      throw new Error(`YouTube Authorization Error (403): ${error.message}`);
    }

    if (error?.code === 401) {
      throw new Error(
        "YouTube OAuth token has expired or was revoked. Please reconnect your channel on the Connected Accounts page."
      );
    }

    throw new Error(`YouTube API Error: ${error?.message || error}`);
  }
}

/**
 * Fetches the authenticated user's YouTube Channel details.
 */
export async function getConnectedChannelInfo(accessToken: string, refreshToken?: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const youtube = google.youtube({
    version: "v3",
    auth: oauth2Client,
  });

  const response = await youtube.channels.list({
    part: ["snippet", "statistics"],
    mine: true,
  });

  const channel = response.data.items?.[0];
  if (!channel) {
    throw new Error("No YouTube channel found for this Google account.");
  }

  return {
    channelId: channel.id,
    title: channel.snippet?.title,
    customUrl: channel.snippet?.customUrl,
    thumbnailUrl: channel.snippet?.thumbnails?.default?.url,
    subscriberCount: channel.statistics?.subscriberCount,
  };
}
