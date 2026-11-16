import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executePlatformPublish, PlatformPublishTaskResult } from "@/lib/engine/publisher";

export const maxDuration = 300; // Allow 5 minutes for parallel cross-platform execution & encoding

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to publish." },
        { status: 401 }
      );
    }

    // Parse form-data
    const formData = await request.formData();
    const file = formData.get("video") as File | null;
    const title = ((formData.get("title") as string) || "").trim();
    const description = ((formData.get("description") as string) || "").trim();
    const hashtags = ((formData.get("hashtags") as string) || "").trim();
    const privacyStatus = ((formData.get("privacyStatus") as string) || "private") as
      | "public"
      | "unlisted"
      | "private";

    // Step 1: Validate video and metadata
    if (!file) {
      return NextResponse.json({ error: "Missing video file in request." }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "Title is required for multi-platform publishing." }, { status: 400 });
    }

    // Step 2: Verify that all three social accounts are connected and authorized
    const { data: accounts, error: accErr } = await supabase
      .from("connected_accounts")
      .select("*")
      .eq("user_id", user.id);

    if (accErr || !accounts) {
      return NextResponse.json({ error: "Failed to query connected accounts." }, { status: 500 });
    }

    const ytAccount = accounts.find((a) => a.platform === "youtube" && a.connection_status === "connected");
    const igAccount = accounts.find((a) => a.platform === "instagram" && a.connection_status === "connected");
    const fbAccount = accounts.find((a) => a.platform === "facebook" && a.connection_status === "connected");

    const missingPlatforms: string[] = [];
    if (!ytAccount) missingPlatforms.push("YouTube");
    if (!igAccount) missingPlatforms.push("Instagram");
    if (!fbAccount) missingPlatforms.push("Facebook");

    if (missingPlatforms.length > 0) {
      return NextResponse.json(
        {
          error: `Missing platform connections: ${missingPlatforms.join(", ")}.`,
          message: `Please connect all 3 platforms in Connected Accounts before using PUBLISH EVERYWHERE.`,
          missingPlatforms,
        },
        { status: 400 }
      );
    }

    // Step 3: Store the video temporarily and securely in Supabase Storage
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const tempStoragePath = `${user.id}/crosspost_${Date.now()}_${sanitizedName}`;

    const { error: uploadErr } = await supabase.storage
      .from("videos")
      .upload(tempStoragePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadErr) {
      return NextResponse.json(
        { error: `Failed to store video in temporary storage: ${uploadErr.message}` },
        { status: 500 }
      );
    }

    // Generate signed URL (valid for 2 hours) for platform ingest engines
    const { data: signedData, error: signErr } = await supabase.storage
      .from("videos")
      .createSignedUrl(tempStoragePath, 7200);

    if (signErr || !signedData?.signedUrl) {
      return NextResponse.json(
        { error: "Failed to generate media access URL for platform publishing." },
        { status: 500 }
      );
    }

    const videoUrl = signedData.signedUrl;

    // Step 4: Create video & publishing job in database
    const { data: videoRecord, error: videoErr } = await supabase
      .from("videos")
      .insert({
        user_id: user.id,
        title,
        description,
        hashtags,
        original_filename: file.name,
        storage_path: tempStoragePath,
        file_size_bytes: file.size,
      })
      .select()
      .single();

    if (videoErr || !videoRecord) {
      return NextResponse.json(
        { error: `Database error creating video record: ${videoErr?.message}` },
        { status: 500 }
      );
    }

    const { data: jobRecord, error: jobErr } = await supabase
      .from("publishing_jobs")
      .insert({
        user_id: user.id,
        video_id: videoRecord.id,
        overall_status: "processing",
      })
      .select()
      .single();

    if (jobErr || !jobRecord) {
      return NextResponse.json(
        { error: `Database error creating publishing job: ${jobErr?.message}` },
        { status: 500 }
      );
    }

    const initialResults = [
      { job_id: jobRecord.id, user_id: user.id, platform: "youtube", publishing_status: "uploading" },
      { job_id: jobRecord.id, user_id: user.id, platform: "instagram", publishing_status: "uploading" },
      { job_id: jobRecord.id, user_id: user.id, platform: "facebook", publishing_status: "uploading" },
    ];
    await supabase.from("publishing_results").insert(initialResults);

    // Step 5: Start the three publishing workflows in parallel
    const platformTasks = [
      executePlatformPublish({
        jobId: jobRecord.id,
        userId: user.id,
        platform: "youtube",
        title,
        description,
        hashtags,
        privacyStatus,
        videoUrl,
        connectedAccount: ytAccount,
      }),
      executePlatformPublish({
        jobId: jobRecord.id,
        userId: user.id,
        platform: "instagram",
        title,
        description,
        hashtags,
        videoUrl,
        connectedAccount: igAccount,
      }),
      executePlatformPublish({
        jobId: jobRecord.id,
        userId: user.id,
        platform: "facebook",
        title,
        description,
        hashtags,
        videoUrl,
        connectedAccount: fbAccount,
      }),
    ];

    const results: PlatformPublishTaskResult[] = await Promise.all(platformTasks);

    // Step 6 & 7: Track progress and save results in Supabase
    let allSucceeded = true;
    let anySucceeded = false;

    for (const res of results) {
      if (res.status === "published") {
        anySucceeded = true;
        await supabase
          .from("publishing_results")
          .update({
            publishing_status: "published",
            platform_video_id: res.platformVideoId,
            published_url: res.publishedUrl,
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("job_id", jobRecord.id)
          .eq("platform", res.platform);
      } else {
        allSucceeded = false;
        await supabase
          .from("publishing_results")
          .update({
            publishing_status: "failed",
            error_message: res.errorMessage || "Unknown error",
            updated_at: new Date().toISOString(),
          })
          .eq("job_id", jobRecord.id)
          .eq("platform", res.platform);
      }
    }

    const overallStatus = allSucceeded
      ? "completed"
      : anySucceeded
      ? "partial"
      : "failed";

    await supabase
      .from("publishing_jobs")
      .update({
        overall_status: overallStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobRecord.id);

    // Step 8: Storage Cleanup
    // When all three platforms succeed, delete temporary video from Supabase Storage
    if (allSucceeded) {
      await supabase.storage.from("videos").remove([tempStoragePath]);
    }

    return NextResponse.json({
      success: true,
      jobId: jobRecord.id,
      overallStatus,
      allSucceeded,
      results,
      tempStorageCleaned: allSucceeded,
    });
  } catch (error: any) {
    console.error("Publish everywhere error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to execute multi-platform publication." },
      { status: 500 }
    );
  }
}
