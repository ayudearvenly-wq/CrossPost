"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  ShieldAlert,
  KeyRound,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Database,
  Check,
  Unlink,
  Loader2,
  RotateCw
} from "lucide-react";
import { YouTubeIcon, InstagramIcon, FacebookIcon } from "@/components/SocialIcons";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

function ConnectedAccountsContent() {
  const { user, isConfigured } = useAuth();
  const searchParams = useSearchParams();
  const [dbAccounts, setDbAccounts] = useState<any[]>([]);
  const [disconnectingPlatform, setDisconnectingPlatform] = useState<string | null>(null);
  const [bannerNotice, setBannerNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const channel = searchParams.get("channel");
    const fbName = searchParams.get("facebook");
    const igName = searchParams.get("instagram");
    const igNotice = searchParams.get("ig_notice");

    if (success === "youtube_connected") {
      setBannerNotice({
        type: "success",
        text: `Successfully connected YouTube Channel: ${channel || "Your Channel"}! Ready to publish Shorts.`,
      });
    } else if (success?.startsWith("meta_connected")) {
      const parts = [];
      if (fbName) parts.push(`Facebook Page: "${fbName}"`);
      if (igName) parts.push(`Instagram Creator: "@${igName}"`);
      const msg = `Successfully connected Meta accounts (${parts.join(", ")})!`;
      setBannerNotice({
        type: "success",
        text: igNotice ? `${msg} (Note: ${igNotice})` : msg,
      });
    } else if (error) {
      setBannerNotice({
        type: "error",
        text: `Connection failed: ${decodeURIComponent(error)}`,
      });
    }
  }, [searchParams]);

  async function loadAccounts() {
    if (!isConfigured || !user) return;
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("connected_accounts")
        .select("*");
      if (!error && data) {
        setDbAccounts(data);
      }
    } catch (err) {
      console.error("Failed to load connected accounts:", err);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, [user, isConfigured]);

  const getAccountData = (platformId: string) => {
    return dbAccounts.find((a) => a.platform === platformId) || null;
  };

  const handleConnectYouTube = () => {
    window.location.assign("/api/auth/youtube");
  };

  const handleConnectMeta = () => {
    window.location.assign("/api/auth/meta");
  };

  const handleDisconnect = async (platform: string) => {
    if (!confirm(`Are you sure you want to disconnect ${platform}? You will need to re-authorize before publishing to it again.`)) {
      return;
    }

    try {
      setDisconnectingPlatform(platform);
      const res = await fetch("/api/accounts/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to disconnect account.");
      } else {
        setBannerNotice({
          type: "success",
          text: `Disconnected ${platform} successfully.`,
        });
        await loadAccounts();
      }
    } catch (err: any) {
      alert(err?.message || "Failed to disconnect account.");
    } finally {
      setDisconnectingPlatform(null);
    }
  };

  const accounts = [
    {
      id: "youtube",
      name: "YouTube Shorts",
      platform: "YouTube",
      icon: YouTubeIcon,
      iconColor: "text-red-500",
      accentBg: "bg-red-500/10 border-red-500/20",
      buttonColor: "bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-600/20",
      data: getAccountData("youtube"),
      description: "Connect your YouTube Channel via Google OAuth 2.0 to upload Shorts directly.",
      scope: "https://www.googleapis.com/auth/youtube.upload",
      notes: "Maximum length 60s. Supports automatic tags, hashtags, and privacy settings.",
      onConnect: handleConnectYouTube,
    },
    {
      id: "instagram",
      name: "Instagram Reels",
      platform: "Instagram",
      icon: InstagramIcon,
      iconColor: "text-pink-500",
      accentBg: "bg-pink-500/10 border-pink-500/20",
      buttonColor: "bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-md shadow-pink-600/20",
      data: getAccountData("instagram"),
      description: "Connect your Instagram Creator account via Meta Graph API v21.0.",
      scope: "instagram_basic, instagram_content_publish",
      notes: "Creator / Business account linked with your Facebook Page via Accounts Center.",
      onConnect: handleConnectMeta,
    },
    {
      id: "facebook",
      name: "Facebook Reels",
      platform: "Facebook",
      icon: FacebookIcon,
      iconColor: "text-blue-500",
      accentBg: "bg-blue-500/10 border-blue-500/20",
      buttonColor: "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20",
      data: getAccountData("facebook"),
      description: "Connect your Facebook Page to publish Reels directly to your page feed.",
      scope: "pages_show_list, pages_read_engagement, pages_manage_posts",
      notes: "Publishes short video reels directly into your managed Facebook Page feed.",
      onConnect: handleConnectMeta,
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
          Connected Accounts
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Manage authorizations, view channel details, and reconnect or disconnect publishing accounts.
        </p>
      </div>

      {bannerNotice && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center space-x-2.5 ${
            bannerNotice.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500"
              : "bg-rose-500/10 border border-rose-500/20 text-rose-500"
          }`}
        >
          {bannerNotice.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{bannerNotice.text}</span>
        </div>
      )}

      {/* Notice */}
      <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-start space-x-3.5 text-xs text-[var(--text-secondary)]">
        <Database className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-[var(--text-primary)]">Account Authorization & Security</p>
          <p className="mt-0.5 leading-relaxed text-[var(--text-muted)]">
            Tokens are refreshed automatically on the server. You can reconnect at any time to refresh authorization or disconnect to revoke access.
          </p>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {accounts.map((acc) => {
          const Icon = acc.icon;
          const isConnected = acc.data?.connection_status === "connected";
          const isDisconnecting = disconnectingPlatform === acc.id;

          return (
            <div
              key={acc.id}
              className={`p-6 rounded-2xl bg-[var(--bg-card)] border ${
                isConnected ? "border-emerald-500/40" : "border-[var(--border)]"
              } flex flex-col justify-between hover:border-[var(--border-subtle)] transition space-y-6 shadow-xs`}
            >
              <div>
                {/* Card Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl border ${acc.accentBg}`}>
                    <Icon className={`w-7 h-7 ${acc.iconColor}`} />
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      isConnected
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500"
                        : "bg-amber-500/10 border border-amber-500/20 text-amber-500"
                    }`}
                  >
                    {isConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">{acc.name}</h2>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 font-semibold">
                    Live OAuth
                  </span>
                </div>

                {acc.data?.account_name ? (
                  <div className="mt-2 p-2.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border)] space-y-1 text-xs">
                    <p className="font-semibold text-emerald-500 flex items-center space-x-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>{acc.data.account_name}</span>
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">
                      ID: {acc.data.account_identifier}
                    </p>
                    {acc.data.token_expires_at && (
                      <p className="text-[10px] text-[var(--text-muted)]">
                        Token expires: {new Date(acc.data.token_expires_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">{acc.description}</p>
                )}

                <div className="mt-5 pt-4 border-t border-[var(--border)] space-y-2 text-xs">
                  <div>
                    <span className="text-[var(--text-secondary)] block font-medium">Specs:</span>
                    <span className="text-[var(--text-muted)] text-[11px] leading-tight block mt-0.5">{acc.notes}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)] block font-medium">Scope:</span>
                    <code className="text-[var(--text-muted)] text-[10px] bg-[var(--bg-card-subtle)] px-2 py-1 rounded border border-[var(--border)] block mt-1 font-mono truncate">
                      {acc.scope}
                    </code>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                {isConnected ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={acc.onConnect}
                      className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border)] flex items-center justify-center space-x-1.5 transition cursor-pointer"
                      title="Reconnect to refresh authorization"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Reconnect</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDisconnect(acc.id)}
                      disabled={isDisconnecting}
                      className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 flex items-center justify-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
                      title="Disconnect this channel"
                    >
                      {isDisconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                      <span>Disconnect</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={acc.onConnect}
                    className={`w-full py-3 px-4 rounded-xl text-xs font-semibold ${acc.buttonColor} flex items-center justify-center space-x-2 transition transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer`}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Connect {acc.platform}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ConnectedAccountsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[var(--text-muted)]">Loading connected channels...</div>}>
      <ConnectedAccountsContent />
    </Suspense>
  );
}
