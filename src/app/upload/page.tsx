"use client";

import { useState, useRef, ChangeEvent, DragEvent, useEffect } from "react";
import Link from "next/link";
import { 
  UploadCloud, 
  Film, 
  Trash2, 
  Tag, 
  FileText, 
  Send,
  AlertCircle,
  CheckCircle,
  Loader2,
  Lock,
  Globe,
  EyeOff,
  ExternalLink,
  RotateCcw,
  Check,
  XCircle,
  Sparkles,
  ShieldCheck
} from "lucide-react";
import { YouTubeIcon, InstagramIcon, FacebookIcon } from "@/components/SocialIcons";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

interface PlatformStatusDisplay {
  platform: "youtube" | "instagram" | "facebook";
  status: "pending" | "uploading" | "published" | "failed";
  platformVideoId?: string;
  publishedUrl?: string;
  errorMessage?: string;
}

export default function UploadPage() {
  const { user, isConfigured } = useAuth();

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hashtags, setHashtags] = useState("#shorts #reels #crosspost");
  const [privacyStatus, setPrivacyStatus] = useState<"public" | "unlisted" | "private">("private");

  const [isDragging, setIsDragging] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [publishProgress, setPublishProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Result state
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [overallStatus, setOverallStatus] = useState<"completed" | "partial" | "failed" | null>(null);
  const [platformStatuses, setPlatformStatuses] = useState<PlatformStatusDisplay[]>([]);
  const [storageCleaned, setStorageCleaned] = useState(false);

  // Connected accounts cache
  const [connectedPlatforms, setConnectedPlatforms] = useState<{
    youtube?: boolean;
    instagram?: boolean;
    facebook?: boolean;
  }>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxTitleLength = 100;
  const maxDescLength = 2200;

  useEffect(() => {
    async function fetchConnections() {
      if (!isConfigured || !user) return;
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("connected_accounts")
          .select("platform, connection_status")
          .eq("user_id", user.id);

        if (data) {
          const map: any = {};
          data.forEach((acc) => {
            map[acc.platform] = acc.connection_status === "connected";
          });
          setConnectedPlatforms(map);
        }
      } catch {
        // Ignored
      }
    }
    fetchConnections();
  }, [user, isConfigured]);

  const allThreeConnected = Boolean(
    connectedPlatforms.youtube && connectedPlatforms.instagram && connectedPlatforms.facebook
  );

  const handleSelectedFile = (file: File) => {
    if (!file.type.startsWith("video/")) {
      setError("Please select a valid video file (MP4, WebM, MOV).");
      return;
    }
    setError(null);
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);
    // Reset previous job results when picking a new video
    setCurrentJobId(null);
    setOverallStatus(null);
    setPlatformStatuses([]);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleSelectedFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleSelectedFile(file);
  };

  const handleClearVideo = () => {
    setVideoFile(null);
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setError(null);
    setCurrentJobId(null);
    setOverallStatus(null);
    setPlatformStatuses([]);
  };

  // ONE-CLICK PUBLISH EVERYWHERE
  const handlePublishEverywhere = async () => {
    if (!videoFile) {
      setError("Please select or drop a video file first.");
      return;
    }
    if (!title.trim()) {
      setError("Please provide a title for your video.");
      return;
    }
    if (!user) {
      setError("You must be logged in to publish. Please sign in.");
      return;
    }

    try {
      setIsPublishing(true);
      setError(null);
      setCurrentJobId(null);
      setOverallStatus(null);
      setPublishProgress("Step 1/5: Uploading video to secure temporary storage...");

      setPlatformStatuses([
        { platform: "youtube", status: "uploading" },
        { platform: "instagram", status: "uploading" },
        { platform: "facebook", status: "uploading" },
      ]);

      const formData = new FormData();
      formData.append("video", videoFile);
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("hashtags", hashtags.trim());
      formData.append("privacyStatus", privacyStatus);

      setPublishProgress("Step 2/5: Dispatching parallel workflows to YouTube, Instagram & Facebook...");

      const response = await fetch("/api/publish/everywhere", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Multi-platform publishing failed.");
      }

      setCurrentJobId(data.jobId);
      setOverallStatus(data.overallStatus);
      setPlatformStatuses(data.results || []);
      setStorageCleaned(Boolean(data.tempStorageCleaned));
      setPublishProgress("");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "An unexpected error occurred during execution.");
      setPublishProgress("");
    } finally {
      setIsPublishing(false);
    }
  };

  // RETRY ONLY FAILED PLATFORMS
  const handleRetryFailed = async () => {
    if (!currentJobId) return;

    try {
      setIsRetrying(true);
      setError(null);
      setPublishProgress("Retrying only failed platforms (idempotent, won't duplicate successful)...");

      const response = await fetch("/api/publish/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: currentJobId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Retry execution failed.");
      }

      setOverallStatus(data.overallStatus);
      setStorageCleaned(Boolean(data.tempStorageCleaned));

      // Merge retry results with existing successes
      setPlatformStatuses((prev) => {
        const next = [...prev];
        data.retryResults?.forEach((retryRes: any) => {
          const idx = next.findIndex((p) => p.platform === retryRes.platform);
          if (idx !== -1) {
            next[idx] = retryRes;
          } else {
            next.push(retryRes);
          }
        });
        return next;
      });

      setPublishProgress("");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Retry failed.");
      setPublishProgress("");
    } finally {
      setIsRetrying(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "youtube":
        return YouTubeIcon;
      case "instagram":
        return InstagramIcon;
      case "facebook":
        return FacebookIcon;
      default:
        return Sparkles;
    }
  };

  const hasFailedPlatforms = platformStatuses.some((p) => p.status === "failed");

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
          One-Click Cross-Platform Publisher
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Upload once, dispatch in parallel to YouTube Shorts, Instagram Reels, and Facebook Reels.
        </p>
      </div>

      {/* Warning if accounts aren't connected */}
      {!allThreeConnected && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500 flex items-start justify-between gap-3">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">All 3 platforms must be connected</p>
              <p className="mt-0.5 text-amber-500/90 leading-relaxed">
                Publish Everywhere requires authorized connections for YouTube Shorts, Instagram Reels, and Facebook Reels.
              </p>
            </div>
          </div>
          <Link
            href="/accounts"
            className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition"
          >
            Connect Accounts
          </Link>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Final Publishing Result Banner */}
      {overallStatus && (
        <div
          className={`p-6 rounded-2xl border shadow-sm space-y-4 ${
            overallStatus === "completed"
              ? "bg-emerald-500/10 border-emerald-500/30"
              : overallStatus === "partial"
              ? "bg-amber-500/10 border-amber-500/30"
              : "bg-rose-500/10 border-rose-500/30"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              {overallStatus === "completed" ? (
                <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0" />
              ) : overallStatus === "partial" ? (
                <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
              ) : (
                <XCircle className="w-6 h-6 text-rose-500 shrink-0" />
              )}
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  {overallStatus === "completed"
                    ? "Published Everywhere Successfully!"
                    : overallStatus === "partial"
                    ? "Partially Published — Some Platforms Failed"
                    : "Publishing Failed on Target Platforms"}
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Job ID: <code className="font-mono text-indigo-400">#{currentJobId?.slice(0, 8)}</code> •{" "}
                  {storageCleaned ? "Temporary video file safely deleted from storage." : "Temporary video retained for retry."}
                </p>
              </div>
            </div>

            {hasFailedPlatforms && (
              <button
                type="button"
                onClick={handleRetryFailed}
                disabled={isRetrying}
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition self-start sm:self-auto cursor-pointer disabled:opacity-50"
              >
                {isRetrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                <span>Retry Failed Platforms</span>
              </button>
            )}
          </div>

          {/* Individual Platform Breakdown Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {platformStatuses.map((p) => {
              const Icon = getPlatformIcon(p.platform);
              const isSuccess = p.status === "published";
              return (
                <div
                  key={p.platform}
                  className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Icon className="w-4 h-4" />
                      <span className="capitalize font-semibold text-xs text-[var(--text-primary)]">{p.platform}</span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                        isSuccess
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          : p.status === "uploading"
                          ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse"
                          : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>

                  {isSuccess ? (
                    <div className="space-y-1 text-xs">
                      <p className="text-[11px] text-[var(--text-muted)] truncate">ID: {p.platformVideoId}</p>
                      {p.publishedUrl && (
                        <a
                          href={p.publishedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 font-medium text-xs mt-1"
                        >
                          <span>Open Live Video</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-rose-400 leading-tight">
                      {p.errorMessage || (p.status === "uploading" ? "Encoding media..." : "Failed to publish")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Drag & Drop Video Selector & Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-4 shadow-xs">
            <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center space-x-2">
              <Film className="w-4 h-4 text-indigo-500" />
              <span>Video File & Preview</span>
            </h2>

            {/* Hidden Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
              id="video-upload"
            />

            {!videoPreviewUrl ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`group flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all text-center ${
                  isDragging
                    ? "border-indigo-500 bg-indigo-500/10 scale-[1.01]"
                    : "border-[var(--border-subtle)] hover:border-indigo-500/70 bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <p className="mt-4 font-semibold text-sm text-[var(--text-primary)]">
                  Drag and drop your short video here
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  or click to browse from device
                </p>
                <span className="mt-4 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-600/10 text-indigo-500 border border-indigo-500/20 group-hover:bg-indigo-600 group-hover:text-white transition">
                  Select Video File
                </span>
                <p className="mt-3 text-[11px] text-[var(--text-muted)]">
                  Vertical 9:16 • Up to 60 seconds
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative aspect-[9/16] max-h-[460px] mx-auto rounded-2xl overflow-hidden bg-black border border-[var(--border)] shadow-md flex items-center justify-center">
                  <video
                    src={videoPreviewUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border)] text-xs">
                  <div className="truncate mr-2">
                    <p className="font-semibold text-[var(--text-primary)] truncate">{videoFile?.name}</p>
                    <p className="text-[var(--text-muted)]">
                      {videoFile ? (videoFile.size / (1024 * 1024)).toFixed(2) : 0} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearVideo}
                    disabled={isPublishing || isRetrying}
                    className="p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition disabled:opacity-50"
                    title="Remove Video"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border)] text-xs text-[var(--text-muted)] space-y-1.5">
              <p className="font-semibold text-[var(--text-secondary)]">Destinations Ready:</p>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span>YouTube Shorts:</span>
                  <span className={connectedPlatforms.youtube ? "text-emerald-500 font-semibold" : "text-amber-500"}>
                    {connectedPlatforms.youtube ? "Connected" : "Disconnected"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Instagram Reels:</span>
                  <span className={connectedPlatforms.instagram ? "text-emerald-500 font-semibold" : "text-amber-500"}>
                    {connectedPlatforms.instagram ? "Connected" : "Disconnected"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Facebook Reels:</span>
                  <span className={connectedPlatforms.facebook ? "text-emerald-500 font-semibold" : "text-amber-500"}>
                    {connectedPlatforms.facebook ? "Connected" : "Disconnected"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Metadata & PUBLISH EVERYWHERE */}
        <div className="lg:col-span-7 space-y-5">
          <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-5 shadow-xs">
            <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center space-x-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              <span>Multi-Platform Metadata</span>
            </h2>

            {/* Video Title */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="video-title" className="text-xs font-semibold text-[var(--text-primary)]">
                  Title <span className="text-rose-500">*</span>
                </label>
                <span className={`text-[11px] font-mono ${title.length > maxTitleLength ? "text-rose-500 font-bold" : "text-[var(--text-muted)]"}`}>
                  {title.length}/{maxTitleLength}
                </span>
              </div>
              <input
                id="video-title"
                type="text"
                disabled={isPublishing || isRetrying}
                maxLength={maxTitleLength}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter title (used for YouTube Shorts & Reel headers)..."
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition disabled:opacity-50"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="video-desc" className="text-xs font-semibold text-[var(--text-primary)]">
                  Description
                </label>
                <span className={`text-[11px] font-mono ${description.length > maxDescLength ? "text-rose-500 font-bold" : "text-[var(--text-muted)]"}`}>
                  {description.length}/{maxDescLength}
                </span>
              </div>
              <textarea
                id="video-desc"
                rows={4}
                disabled={isPublishing || isRetrying}
                maxLength={maxDescLength}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description, credits, or links..."
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition resize-none disabled:opacity-50"
              />
            </div>

            {/* Hashtags */}
            <div className="space-y-1.5">
              <label htmlFor="video-tags" className="block text-xs font-semibold text-[var(--text-primary)] flex items-center space-x-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-500" />
                <span>Hashtags</span>
              </label>
              <input
                id="video-tags"
                type="text"
                disabled={isPublishing || isRetrying}
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#shorts #reels #crosspost"
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition font-mono text-xs disabled:opacity-50"
              />
            </div>

            {/* Privacy Setting (YouTube) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--text-primary)]">
                YouTube Privacy Setting
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "private", label: "Private", desc: "Only you", icon: Lock },
                  { id: "unlisted", label: "Unlisted", desc: "Anyone with link", icon: EyeOff },
                  { id: "public", label: "Public", desc: "Everyone", icon: Globe },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = privacyStatus === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={isPublishing || isRetrying}
                      onClick={() => setPrivacyStatus(item.id as any)}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1 transition text-xs ${
                        isSelected
                          ? "bg-indigo-600/10 border-indigo-500 text-indigo-500 font-semibold"
                          : "bg-[var(--bg-card-subtle)] border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Progress Banner */}
            {publishProgress && (
              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-xs flex items-center space-x-2 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>{publishProgress}</span>
              </div>
            )}

            {/* Big PUBLISH EVERYWHERE Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handlePublishEverywhere}
                disabled={isPublishing || isRetrying}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white font-extrabold text-base tracking-wide shadow-xl shadow-indigo-600/25 transition transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center space-x-3 cursor-pointer disabled:opacity-50"
              >
                {isPublishing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                <span>
                  {isPublishing ? "PUBLISHING TO ALL 3 PLATFORMS..." : "PUBLISH EVERYWHERE"}
                </span>
              </button>
              <p className="mt-2.5 text-center text-xs text-[var(--text-muted)]">
                Dispatches simultaneously to YouTube Shorts, Instagram Reels, and Facebook Reels.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
