"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import InteractiveAuthGradient from "@/components/InteractiveAuthGradient";
import { AuroraThread } from "@/components/AuroraThread";
import { Lock, Mail, ShieldCheck, ArrowRight, Loader2, Check } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

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
        setError(data?.error?.message ?? "Invalid credentials. Please try again.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Could not reach authentication server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center bg-background text-foreground p-4 md:p-8 font-sans overflow-hidden">
      <AuroraThread variant="mesh" size="sm" className="lg:hidden" />
      <div className="relative w-full max-w-6xl bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] shadow-[0_0_40px_rgba(34,211,238,0.1)] overflow-hidden flex min-h-[750px]">
        
        {/* Left Side: Form */}
        <div className="w-full lg:w-[55%] p-10 md:p-16 flex flex-col justify-center bg-transparent order-2 lg:order-1">
          <div className="max-w-md w-full mx-auto">
            <div className="flex items-center justify-between mb-8">
              <Link href="/" className="inline-flex items-center gap-3 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/amadeus.svg" alt="Amadeus" className="w-9 h-9 object-contain drop-shadow-sm transition-transform group-hover:scale-110" />
                <span className="font-extrabold text-xl tracking-tight text-foreground">Amadeus</span>
              </Link>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-full text-fuchsia-400 text-[10px] font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                Admin Portal
              </div>
            </div>

            <h1 className="text-3xl font-extrabold text-foreground mb-2 tracking-tight">Welcome back.</h1>
            <p className="text-[14px] text-slate-400 mb-8">Log in to your orchestrator administration dashboard.</p>

            {/* SSO Placeholder */}
            <button
              type="button"
              onClick={() => alert("SSO integration is not configured in this environment.")}
              className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3.5 text-[14px] font-bold text-slate-200 hover:border-slate-500 hover:bg-slate-800 transition-all focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
            >
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              Sign in with SAML SSO
            </button>

            <div className="flex items-center gap-4 my-6">
              <div className="h-px flex-1 bg-slate-800"></div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">or continue with email</span>
              <div className="h-px flex-1 bg-slate-800"></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-300 mb-1.5 ml-1">Work Email</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@company.com"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/50 pl-11 pr-4 py-3.5 text-[14px] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 focus:border-cyan-400 focus:bg-slate-900 transition-all"
                    autoComplete="username"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-[12px] font-bold text-slate-300 mb-1.5 ml-1">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/50 pl-11 pr-4 py-3.5 text-[14px] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 focus:border-cyan-400 focus:bg-slate-900 transition-all"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 pb-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${rememberMe ? 'bg-cyan-500 border-cyan-500' : 'border-slate-700 group-hover:border-cyan-400'}`}>
                    <Check className={`w-3 h-3 text-white transition-opacity ${rememberMe ? 'opacity-100' : 'opacity-0'}`} />
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden" 
                    checked={rememberMe}
                    onChange={() => setRememberMe(!rememberMe)}
                  />
                  <span className="text-[13px] font-medium text-slate-400 group-hover:text-slate-200 transition-colors">Remember me</span>
                </label>
                
                <a href="#" className="text-[13px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">
                  Forgot password?
                </a>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mt-2 animate-in fade-in slide-in-from-top-2">
                  <p className="text-[13px] text-red-600 font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full relative overflow-hidden rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white text-[15px] font-bold py-4 mt-6 hover:opacity-90 disabled:opacity-70 transition-all shadow-[0_0_20px_rgba(217,70,239,0.3)] hover:shadow-[0_0_30px_rgba(217,70,239,0.5)] active:scale-[0.98] group"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                <div className="relative flex items-center justify-center gap-2">
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Authenticating...</>
                  ) : (
                    <>Sign In <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                  )}
                </div>
              </button>
            </form>

            <div className="mt-8 text-center text-[13px] text-slate-500">
              Don't have an administrator account?{" "}
              <Link href="/signup" className="font-bold text-fuchsia-400 hover:text-fuchsia-300 transition-colors">
                Request access
              </Link>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Gradient */}
        <div className="hidden lg:block lg:w-[45%] p-4 order-1 lg:order-2">
          <InteractiveAuthGradient 
            title="Enterprise Orchestration."
            description="Log in to manage your robotic process automation flows, oversee agents, and monitor telemetry."
          />
        </div>
      </div>
    </div>
  );
}
