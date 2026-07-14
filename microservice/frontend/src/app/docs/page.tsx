import Link from 'next/link';
import { FileText, ArrowRight } from 'lucide-react';
import { DOCS_NAV } from '@/content/docsNav';

export default function DocsIndex() {
  return (
    <div className="p-8 lg:p-16 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[500px] opacity-20 bg-gradient-to-b from-blue-50 to-transparent pointer-events-none z-0"></div>

      <div className="relative z-10 max-w-4xl">
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Developer <span className="vibrant-rainbow-text">Documentation</span>
          </h1>
          <p className="text-xl text-slate-600 mt-4 max-w-2xl">
            Everything that exists in this repository — the LC settlement stack, the
            legacy agent platform, the MCP servers, both frontends, and the gaps between
            them. Start with Architecture Overview if you're new here.
          </p>
        </header>

        <div className="space-y-10">
          {DOCS_NAV.map((group) => (
            <div key={group.title}>
              <h2 className="text-xs font-bold text-slate-400 mb-3">
                {group.title}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.items.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/docs/${item.slug}`}
                    className="bg-white border border-slate-200 p-5 rounded-xl hover:-translate-y-0.5 hover:shadow-md transition-all flex justify-between items-center group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-slate-500 group-hover:text-blue-500 transition-colors" />
                      </div>
                      <h3 className="font-semibold text-sm text-slate-900">{item.title}</h3>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
