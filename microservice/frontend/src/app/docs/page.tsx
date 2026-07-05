import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { FileText, ArrowRight, ArrowLeft } from 'lucide-react';

export default function DocsIndex() {
  const docsDir = path.join(process.cwd(), 'src/content/docs');
  let docs: string[] = [];
  
  try {
    docs = fs.readdirSync(docsDir)
      .filter(file => file.endsWith('.md'))
      .map(file => file.replace('.md', ''));
  } catch (error) {
    console.error('Error reading docs directory:', error);
  }

  return (
    <div className="min-h-screen p-8 lg:p-24 relative overflow-hidden bg-[#FAFAFA] text-slate-900">
      <div className="absolute top-0 left-0 w-full h-[500px] opacity-20 bg-gradient-to-b from-blue-50 to-transparent pointer-events-none z-0"></div>
      
      <div className="relative z-10 max-w-5xl mx-auto">
        <header className="mb-12">
          <Link href="/" className="inline-flex items-center text-slate-500 hover:text-slate-900 mb-6 uppercase tracking-wider text-sm font-mono transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" /> Return to Core
          </Link>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Developer <span className="vibrant-rainbow-text">Documentation</span>
          </h1>
          <p className="text-xl text-slate-600 mt-4 max-w-2xl">
            Explore the architecture, API flows, and security guidelines for the Amadeus Agentic Orchestrator.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {docs.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 border border-slate-200 bg-white rounded-xl">
              No documentation found in src/content/docs.
            </div>
          ) : (
            docs.map((docSlug) => (
              <Link 
                key={docSlug} 
                href={`/docs/${docSlug}`}
                className="bg-white border border-slate-200 p-6 rounded-xl hover:-translate-y-1 hover:shadow-md transition-all flex justify-between items-center group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-slate-500 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 capitalize">
                      {docSlug.replace(/-/g, ' ')}
                    </h3>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
