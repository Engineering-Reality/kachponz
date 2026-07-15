"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import InteractiveAuthGradient from "@/components/InteractiveAuthGradient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Login gagal");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Tidak bisa menghubungi server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 p-4 md:p-8">
      <div className="w-full max-w-6xl bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl shadow-slate-200/60 overflow-hidden flex min-h-[700px]">
        
        {/* Left Side: Form */}
        <div className="w-full lg:w-1/2 p-10 md:p-16 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            <Link href="/" className="inline-flex items-center gap-3 mb-10 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/amadeus.svg" alt="Amadeus" className="w-10 h-10 object-contain drop-shadow-sm filter-none transition-transform group-hover:scale-110" />
              <span className="font-extrabold text-xl tracking-tight text-slate-900">Amadeus</span>
            </Link>

            <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Welcome back.</h1>
            <p className="text-[15px] text-slate-500 mb-10">Log in to your orchestrator dashboard.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-2">Work Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@bankmandiri.co.id"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm"
                  autoComplete="username"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[13px] font-bold text-slate-700">Password</label>
                  <a href="#" className="text-xs font-semibold text-blue-600 hover:text-blue-700">Forgot?</a>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm"
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <p className="text-[13px] text-red-600 font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-slate-900 text-white text-[15px] font-bold py-3.5 mt-4 hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg shadow-slate-900/10 hover:shadow-slate-900/20 active:scale-[0.98]"
              >
                {loading ? "Authenticating…" : "Sign In"}
              </button>
            </form>

            <div className="mt-8 text-center text-[14px] text-slate-500">
              Don't have an account?{" "}
              <Link href="/signup" className="font-bold text-slate-900 hover:text-blue-600 transition-colors">
                Request access
              </Link>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Gradient */}
        <div className="hidden lg:block lg:w-1/2 p-4">
          <InteractiveAuthGradient 
            title="Enterprise Orchestration."
            description="Log in to manage your robotic process automation flows, oversee agents, and monitor telemetry."
          />
        </div>
      </div>
    </div>
  );
}
