"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Layers, LogIn, Lock, Mail, AlertCircle, Sparkles, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { isConfigured } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!isConfigured) {
      // Demo / offline guidance
      setTimeout(() => {
        setLoading(false);
        router.push("/");
      }, 500);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred during login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/25">
            <Layers className="w-6 h-6" />
          </div>
          <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
            Sign in to CrossPost
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-[var(--text-muted)]">
            Personal creator hub for short video multi-platform publishing
          </p>
        </div>

        {!isConfigured && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500 space-y-1">
            <p className="font-semibold flex items-center space-x-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Supabase Credentials Setup Pending</span>
            </p>
            <p className="text-[11px] text-amber-500/90 leading-relaxed">
              Add your Supabase Project URL and Anon Key in <code className="bg-amber-500/20 px-1 py-0.5 rounded font-mono">.env.local</code> to activate live cloud authentication. You can preview login right now.
            </p>
          </div>
        )}

        <div className="p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="creator@crosspost.dev"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs tracking-wide shadow-md shadow-indigo-600/25 transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? "Signing in..." : "Sign In"}</span>
            </button>
          </form>

          <div className="pt-4 border-t border-[var(--border)] text-center text-xs text-[var(--text-muted)]">
            <span>Don't have an account? </span>
            <Link href="/register" className="text-indigo-500 font-semibold hover:underline">
              Register now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
