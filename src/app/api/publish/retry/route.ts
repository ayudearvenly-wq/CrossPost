import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executePlatformPublish, PlatformPublishTaskResult } from "@/lib/engine/publisher";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { jobId } = await request.json();
    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId." }, { status: 400 });
    }

    // 1. Fetch job with video and current publishing results
    const { data: job, error: jobErr } = await supabase
      .from("publishing_jobs")
      .select(`
        id,
        overall_status,
        video_id,
        videos (
          id,
          title,
          description,
          hashtags,
          storage_path
        ),
        publishing_results (
          id,
          platform,
          publishing_status,
          platform_video_id,
          published_url,
          retry_count
        )
      `)
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobErr || !job || !job.videos) {
      return NextResponse.json({ error: "Job or video record not found." }, { status: 404 });
    }

    // Supabase relation type cast
    const videoData = (Array.isArray(job.videos) ? job.videos[0] : job.videos) as {
      id: string;
      title: string;
      description: string;
      hashtags: string;
      storage_path: string;
    };

    if (!videoData) {
      return NextResponse.json({ error: "Associated video details not found." }, { status: 404 });
    }

    // 2. Identify only failed platforms
    const failedResults = job.publishing_results.filter(
      (r: any) => r.publishing_status === "failed" || r.publishing_status === "pending"
    );

    if (failedResults.length === 0) {
      return NextResponse.json({
        message: "All platforms for this job are already published successfully. No retry needed.",
        jobId,
        overallStatus: "completed",
      });
    }

    // 3. Obtain temporary video signed URL
    const { data: signedData, error: signErr } = await supabase.storage
      .from("videos")
      .createSignedUrl(videoData.storage_path, 7200);

    if (signErr || !signedData?.signedUrl) {
      return NextResponse.json(
        { error: "Could not access video from temporary storage. The file may have already been cleaned or expired." },
        { status: 400 }
      );
    }
    const videoUrl = signedData.signedUrl;

    // 4. Fetch user's connected accounts
    const { data: accounts } = await supabase
      .from("connected_accounts")
      .select("*")
      .eq("user_id", user.id);

    // 5. Execute retries ONLY for failed platforms (Idempotent: Never re-publish succeeded platforms)
    const retryTasks = failedResults.map(async (resItem: any) => {
      const platform = resItem.platform as "youtube" | "instagram" | "facebook";
      const connectedAcc = accounts?.find(
        (a) => a.platform === platform && a.connection_status === "connected"
      );

      if (!connectedAcc) {
        return {
          platform,
          status: "failed" as const,
          errorMessage: `Platform ${platform} is not currently connected. Please connect it first.`,
        };
      }

      // Increment retry counter
      await supabase
        .from("publishing_results")
        .update({
          publishing_status: "uploading",
          retry_count: (resItem.retry_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", resItem.id);

      return await executePlatformPublish({
        jobId: job.id,
        userId: user.id,
        platform,
        title: videoData.title,
        description: videoData.description,
        hashtags: videoData.hashtags,
        videoUrl,
        connectedAccount: connectedAcc,
      });
    });

    const retryResults: PlatformPublishTaskResult[] = await Promise.all(retryTasks);

    // Update database records
    for (const r of retryResults) {
      if (r.status === "published") {
        await supabase
          .from("publishing_results")
          .update({
            publishing_status: "published",
            platform_video_id: r.platformVideoId,
            published_url: r.publishedUrl,
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("job_id", job.id)
          .eq("platform", r.platform);
      } else {
        await supabase
          .from("publishing_results")
          .update({
            publishing_status: "failed",
            error_message: r.errorMessage || "Retry failed",
            updated_at: new Date().toISOString(),
          })
          .eq("job_id", job.id)
          .eq("platform", r.platform);
      }
    }

    // Check all results across the job now
    const { data: currentResults } = await supabase
      .from("publishing_results")
      .select("publishing_status")
      .eq("job_id", job.id);

    const allSucceeded = currentResults?.every((r) => r.publishing_status === "published") || false;
    const newOverallStatus = allSucceeded ? "completed" : "partial";

    await supabase
      .from("publishing_jobs")
      .update({
        overall_status: newOverallStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    // Clean storage if all have now succeeded
    if (allSucceeded) {
      await supabase.storage.from("videos").remove([videoData.storage_path]);
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      overallStatus: newOverallStatus,
      allSucceeded,
      retryResults,
      tempStorageCleaned: allSucceeded,
    });
  } catch (error: any) {
    console.error("Retry publish error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to retry publishing." },
      { status: 500 }
    );
  }
}
