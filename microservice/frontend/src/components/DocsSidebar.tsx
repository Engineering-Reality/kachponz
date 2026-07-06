"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { DOCS_NAV } from "@/content/docsNav";

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-100 bg-white/60 backdrop-blur-sm sticky top-0 h-screen overflow-y-auto">
      <div className="p-5">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-900 text-xs font-mono uppercase tracking-wider mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </Link>
        <Link href="/docs" className="flex items-center gap-2 mb-8">
          <BookOpen className="w-4.5 h-4.5 text-blue-500" />
          <span className="font-extrabold text-sm tracking-tight text-slate-900">
            Amadeus Docs
          </span>
        </Link>

        <nav className="space-y-6">
          {DOCS_NAV.map((group) => (
            <div key={group.title}>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-2">
                {group.title}
              </h4>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const href = `/docs/${item.slug}`;
                  const isActive = pathname === href;
                  return (
                    <li key={item.slug}>
                      <Link
                        href={href}
                        className={`block px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          isActive
                            ? "bg-blue-50 text-blue-700"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        {item.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
