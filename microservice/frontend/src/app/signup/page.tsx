"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import InteractiveAuthGradient from "@/components/InteractiveAuthGradient";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Mock signup flow - in a real app, hit an API endpoint here
    setTimeout(() => {
      setLoading(false);
      router.push("/dashboard");
    }, 1000);
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 p-4 md:p-8">
      <div className="w-full max-w-6xl bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl shadow-slate-200/60 overflow-hidden flex min-h-[700px]">
        
        {/* Left Side: Interactive Gradient */}
        <div className="hidden lg:block lg:w-1/2 p-4">
          <InteractiveAuthGradient 
            title="The 1st Agentic Platform for RPA."
            description="Coordinate human analysts, intelligent AI agents, and legacy RPA bots to fully automate your complex operations."
          />
        </div>

        {/* Right Side: Form */}
        <div className="w-full lg:w-1/2 p-10 md:p-16 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            <Link href="/" className="inline-flex items-center gap-3 mb-10 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/amadeus.svg" alt="Amadeus" className="w-10 h-10 object-contain drop-shadow-sm filter-none transition-transform group-hover:scale-110" />
              <span className="font-extrabold text-xl tracking-tight text-slate-900">Amadeus</span>
            </Link>

            <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Request Access</h1>
            <p className="text-[15px] text-slate-500 mb-10">Join the orchestration platform built for scale.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-2">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:bg-white transition-all shadow-sm"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-2">Work Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@bankmandiri.co.id"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:bg-white transition-all shadow-sm"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-2">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:bg-white transition-all shadow-sm"
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-slate-900 text-white text-[15px] font-bold py-3.5 mt-4 hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg shadow-slate-900/10 hover:shadow-slate-900/20 active:scale-[0.98]"
              >
                {loading ? "Creating account…" : "Request Access"}
              </button>
            </form>

            <div className="mt-8 text-center text-[14px] text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="font-bold text-slate-900 hover:text-pink-600 transition-colors">
                Sign in
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
