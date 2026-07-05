"use client";

import Image from "next/image";
import Link from "next/link";
import { Inter } from "next/font/google";
import { motion } from "framer-motion";
import { 
  ShieldCheck, 
  Lock, 
  Server, 
  FileCheck, 
  Database,
  ArrowRight,
  Bot,
  Activity,
  Scan,
  UserCheck
} from "lucide-react";

// Setup Inter font
const inter = Inter({ subsets: ['latin'] });

export default function Home() {
  return (
    <div className={`min-h-screen bg-[#FAFAFA] text-slate-900 ${inter.className}`}>
      
      {/* 1. Top Banner & Header */}
      <div className="w-full vibrant-rainbow-border text-white py-2 text-center text-xs font-semibold tracking-wide">
        ✨ Amadeus v2.0 is live: Now with full MCP (Model Context Protocol) Support for UiPath.
      </div>
      
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image src="/amadeus.svg" alt="Amadeus Logo" width={28} height={28} priority />
            <span className="font-bold text-xl tracking-tight">Amadeus</span>
          </Link>
          
          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <Link href="#" className="hover:text-slate-900 transition-colors">Product</Link>
            <Link href="#" className="hover:text-slate-900 transition-colors">Solutions</Link>
            <Link href="#" className="hover:text-slate-900 transition-colors">Compliance</Link>
            <Link href="#" className="hover:text-slate-900 transition-colors">Docs</Link>
          </nav>
          
          {/* CTAs */}
          <div className="flex items-center gap-4">
            <Link href="#" className="hidden md:block text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Book a Demo
            </Link>
            <Link href="/dashboard" className="bg-black text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm">
              Deploy On-Prem
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-col items-center w-full">
        
        {/* 2. Hero Section */}
        <section className="w-full max-w-7xl mx-auto px-6 py-24 md:py-32 flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 flex flex-col items-start text-left">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6"
            >
              Enterprise Agentic Orchestration for <span className="vibrant-rainbow-text">Trade Finance.</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-xl text-slate-600 leading-relaxed mb-10 max-w-2xl"
            >
              Turn hours of manual LC/SKBDN settlement into seconds. Amadeus orchestrates UiPath robots and Air-gapped AI Agents with absolute CISO compliance.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Link href="/dashboard" className="bg-black text-white px-8 py-4 rounded-xl font-semibold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                View Documentation <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/agents" className="bg-white text-slate-900 border border-slate-200 px-8 py-4 rounded-xl font-semibold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
                Architecture Overview
              </Link>
            </motion.div>
          </div>
          
          {/* Isometric CSS Visual */}
          <div className="flex-1 w-full flex justify-center lg:justify-end relative h-[400px]">
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-400 via-purple-400 to-orange-400 opacity-10 rounded-full blur-3xl w-[300px] h-[300px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
            
            <div className="relative w-[300px] h-[300px] group perspective-[1000px]">
              <div className="absolute inset-0 transform-style-3d rotate-x-[60deg] rotate-z-[-45deg] group-hover:rotate-z-[-35deg] transition-transform duration-1000 ease-in-out">
                {/* Layer 1: Legacy Core */}
                <div className="absolute w-[200px] h-[200px] bg-slate-100 border border-slate-300 rounded-2xl shadow-xl transform translate-z-[0px] flex items-center justify-center">
                  <Database className="w-12 h-12 text-slate-300" />
                </div>
                {/* Layer 2: RPA */}
                <div className="absolute w-[200px] h-[200px] bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-xl transform translate-z-[60px] flex items-center justify-center">
                  <Bot className="w-12 h-12 text-blue-400" />
                </div>
                {/* Layer 3: Orchestrator */}
                <div className="absolute w-[200px] h-[200px] bg-white/60 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl transform translate-z-[120px] flex items-center justify-center">
                  <Activity className="w-12 h-12 text-purple-500" />
                </div>
                {/* Layer 4: AI Agent */}
                <div className="absolute w-[200px] h-[200px] bg-white/40 backdrop-blur-lg border border-pink-200 rounded-2xl shadow-2xl transform translate-z-[180px] flex items-center justify-center vibrant-rainbow-border p-[2px]">
                  <div className="w-full h-full bg-white/90 rounded-2xl flex items-center justify-center">
                    <Scan className="w-12 h-12 text-pink-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Trust & Compliance Band */}
        <section className="w-full border-y border-slate-200 bg-white overflow-hidden py-8">
          <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-center md:justify-between items-center gap-8 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
            <div className="flex items-center gap-2 text-slate-500 font-medium">
              <ShieldCheck className="w-5 h-5" /> ISO 27001 Ready
            </div>
            <div className="flex items-center gap-2 text-slate-500 font-medium">
              <Lock className="w-5 h-5" /> HMAC-SHA512 Secured
            </div>
            <div className="flex items-center gap-2 text-slate-500 font-medium">
              <Server className="w-5 h-5" /> Air-Gapped LLM Support
            </div>
            <div className="flex items-center gap-2 text-slate-500 font-medium">
              <FileCheck className="w-5 h-5" /> OJK & BI Compliant
            </div>
            <div className="flex items-center gap-2 text-slate-500 font-medium">
              <Database className="w-5 h-5" /> Optimistic Locking
            </div>
          </div>
        </section>

        {/* 4. Value Proposition Banner */}
        <section className="w-full max-w-7xl mx-auto px-6 py-24">
          <div className="relative rounded-3xl p-[2px] vibrant-rainbow-border overflow-hidden group hover:shadow-xl transition-shadow duration-500">
            <div className="bg-white rounded-[22px] w-full h-full p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
              <div className="flex-1">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-slate-900">
                  Built for Bank Mandiri's Security Standards.
                </h2>
                <Link href="#" className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-semibold hover:bg-slate-800 transition-colors mt-6">
                  Read Security Whitepaper <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="flex-1 flex flex-col gap-6 w-full">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-50 p-2 rounded-lg text-blue-600 mt-1">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-slate-900">Dual Authentication</h3>
                    <p className="text-slate-600 mt-1">X-Robot-Key & Cryptographic Signature validation.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-purple-50 p-2 rounded-lg text-purple-600 mt-1">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-slate-900">Append-only Audit Trails</h3>
                    <p className="text-slate-600 mt-1">Immutable transaction logs for strict compliance auditing.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-pink-50 p-2 rounded-lg text-pink-600 mt-1">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-slate-900">Standalone MCP Servers</h3>
                    <p className="text-slate-600 mt-1">Secure, isolated tool execution for UiPath & Eximbills.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Features Bento Grid */}
        <section className="w-full max-w-7xl mx-auto px-6 py-12 mb-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
              We coordinate your most complex workflows.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Row 1: Stateful MCP (Full Width on Mobile, 2/3 on Desktop - Wait, to do 2/3 we span 2 cols) */}
            <div className="md:col-span-3 bg-white border border-slate-200 rounded-3xl p-10 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col md:flex-row items-center gap-12 overflow-hidden relative">
              <div className="flex-1 z-10">
                <h3 className="text-2xl font-bold text-slate-900 mb-3">Stateful MCP-First Architecture.</h3>
                <p className="text-slate-600 text-lg">
                  LLMs never touch your credentials. Agents talk to secure Model Context Protocol servers.
                </p>
              </div>
              
              <div className="flex-1 w-full h-[250px] relative flex items-center justify-center">
                {/* Abstract Node connecting to Server */}
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-20 h-20 bg-white rounded-2xl shadow-xl border border-slate-100 flex items-center justify-center animate-bounce" style={{ animationDuration: '3s' }}>
                    <Bot className="w-8 h-8 text-blue-500" />
                  </div>
                  <div className="w-24 h-[2px] bg-slate-200 relative overflow-hidden">
                    <div className="absolute inset-0 bg-blue-500 transform -translate-x-full animate-[slide_2s_infinite]"></div>
                  </div>
                  <div className="w-24 h-24 bg-slate-900 rounded-2xl shadow-2xl flex items-center justify-center text-white">
                    <Server className="w-10 h-10 text-cyan-400" />
                  </div>
                </div>
                {/* Decorative background blob */}
                <div className="absolute top-1/2 right-10 -translate-y-1/2 w-48 h-48 bg-blue-50 rounded-full blur-3xl z-0"></div>
              </div>
            </div>

            {/* Row 2, Col 1: Cross-Platform RPA */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col group">
              <div className="h-40 w-full bg-slate-50 rounded-2xl mb-6 flex items-center justify-center relative overflow-hidden border border-slate-100">
                <div className="flex items-center gap-4">
                  <Bot className="w-10 h-10 text-orange-500 transform group-hover:-translate-x-2 transition-transform" />
                  <div className="w-8 h-8 bg-orange-100 rounded flex items-center justify-center animate-pulse">
                    <div className="w-4 h-4 bg-orange-400 rounded-sm"></div>
                  </div>
                  <Activity className="w-10 h-10 text-blue-500 transform group-hover:translate-x-2 transition-transform" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Cross-Platform RPA.</h3>
              <p className="text-slate-600">
                Seamless asynchronous handoffs between UiPath and Power Automate.
              </p>
            </div>

            {/* Row 2, Col 2: Vision & OCR Ready */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col group">
              <div className="h-40 w-full bg-slate-50 rounded-2xl mb-6 flex items-center justify-center relative overflow-hidden border border-slate-100">
                <div className="flex flex-col items-center gap-2 relative z-10">
                  <Scan className="w-10 h-10 text-purple-500 mb-2 transform group-hover:scale-110 transition-transform" />
                  <div className="flex gap-2">
                    <div className="w-12 h-2 bg-slate-200 rounded-full"></div>
                    <div className="w-8 h-2 bg-purple-200 rounded-full"></div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-8 h-2 bg-slate-200 rounded-full"></div>
                    <div className="w-12 h-2 bg-purple-200 rounded-full"></div>
                  </div>
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Vision & OCR Ready.</h3>
              <p className="text-slate-600">
                Extract structured JSON from complex LC application images.
              </p>
            </div>

            {/* Row 2, Col 3: Human-in-the-Loop */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col group">
              <div className="h-40 w-full bg-slate-50 rounded-2xl mb-6 flex items-center justify-center relative overflow-hidden border border-slate-100">
                <div className="relative">
                  <div className="w-16 h-16 bg-white shadow-md rounded-2xl border border-slate-100 flex items-center justify-center transform group-hover:rotate-12 transition-transform z-10 relative">
                    <ShieldCheck className="w-8 h-8 text-green-500" />
                  </div>
                  <div className="w-12 h-12 bg-slate-900 rounded-full absolute -bottom-2 -right-2 flex items-center justify-center text-white border-4 border-slate-50 z-20">
                    <UserCheck className="w-5 h-5 text-cyan-400" />
                  </div>
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Human-in-the-Loop.</h3>
              <p className="text-slate-600">
                Built-in Maker/Checker gates with JWT OAuth2 integration.
              </p>
            </div>

          </div>
        </section>

        {/* 6. Developer Tools & Sandboxes */}
        <section className="w-full max-w-7xl mx-auto px-6 pb-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Developer Tools & Sandboxes
            </h2>
            <p className="text-slate-500 mt-2">Access your local testing environments and architecture tools.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Link href="/dashboard" className="bg-white border border-slate-200 rounded-2xl p-6 hover:-translate-y-1 hover:shadow-lg transition-all flex flex-col group">
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-50 transition-colors">
                <Activity className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="font-bold text-slate-900">Transaction Tracker</h3>
              <p className="text-sm text-slate-500 mt-1">Monitor state machine transitions.</p>
            </Link>

            <Link href="/agents" className="bg-white border border-slate-200 rounded-2xl p-6 hover:-translate-y-1 hover:shadow-lg transition-all flex flex-col group">
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-orange-50 transition-colors">
                <Bot className="w-5 h-5 text-orange-500" />
              </div>
              <h3 className="font-bold text-slate-900">Agent Matrix</h3>
              <p className="text-sm text-slate-500 mt-1">Manage local AI agents.</p>
            </Link>

            <Link href="/tools" className="bg-white border border-slate-200 rounded-2xl p-6 hover:-translate-y-1 hover:shadow-lg transition-all flex flex-col group">
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-50 transition-colors">
                <Server className="w-5 h-5 text-purple-500" />
              </div>
              <h3 className="font-bold text-slate-900">MCP Tool Registry</h3>
              <p className="text-sm text-slate-500 mt-1">Configure attached tool servers.</p>
            </Link>

            <Link href="/agent-creator" className="bg-white border border-slate-200 rounded-2xl p-6 hover:-translate-y-1 hover:shadow-lg transition-all flex flex-col group">
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-pink-50 transition-colors">
                <ShieldCheck className="w-5 h-5 text-pink-500" />
              </div>
              <h3 className="font-bold text-slate-900">Agent Creator</h3>
              <p className="text-sm text-slate-500 mt-1">Design agents via natural language.</p>
            </Link>

            <Link href="/agent-invoke" className="bg-white border border-slate-200 rounded-2xl p-6 hover:-translate-y-1 hover:shadow-lg transition-all flex flex-col group">
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-cyan-50 transition-colors">
                <Activity className="w-5 h-5 text-cyan-500" />
              </div>
              <h3 className="font-bold text-slate-900">Agent Invoke (Stream)</h3>
              <p className="text-sm text-slate-500 mt-1">Test agent reasoning and tool calling.</p>
            </Link>

            <Link href="/docs" className="bg-white border border-slate-200 rounded-2xl p-6 hover:-translate-y-1 hover:shadow-lg transition-all flex flex-col group">
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-yellow-50 transition-colors">
                <FileCheck className="w-5 h-5 text-yellow-600" />
              </div>
              <h3 className="font-bold text-slate-900">Documentation</h3>
              <p className="text-sm text-slate-500 mt-1">Read the system architecture docs.</p>
            </Link>
          </div>
        </section>

      </main>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slide {
          100% { transform: translateX(100%); }
        }
        .transform-style-3d {
          transform-style: preserve-3d;
        }
      `}} />
    </div>
  );
}
