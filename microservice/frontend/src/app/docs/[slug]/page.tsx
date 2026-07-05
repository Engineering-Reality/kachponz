import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, BookOpen } from 'lucide-react';

export async function generateStaticParams() {
  const docsDir = path.join(process.cwd(), 'src/content/docs');
  try {
    const files = fs.readdirSync(docsDir);
    return files
      .filter(file => file.endsWith('.md'))
      .map(file => ({
        slug: file.replace('.md', '')
      }));
  } catch (e) {
    return [];
  }
}

export default function DocViewer({ params }: { params: { slug: string } }) {
  const docsDir = path.join(process.cwd(), 'src/content/docs');
  const filePath = path.join(docsDir, `${params.slug}.md`);

  if (!fs.existsSync(filePath)) {
    notFound();
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  return (
    <div className="min-h-screen p-8 lg:p-24 bg-[#FAFAFA] text-slate-900 relative">
      <div className="absolute top-0 left-0 w-full h-[300px] opacity-20 bg-gradient-to-b from-slate-200 to-transparent pointer-events-none z-0"></div>
      
      <div className="relative z-10 max-w-4xl mx-auto">
        <Link href="/docs" className="inline-flex items-center text-slate-500 hover:text-slate-900 mb-8 uppercase tracking-wider text-sm font-mono transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Docs Index
        </Link>
        
        <article className="bg-white border border-slate-200 rounded-2xl p-8 md:p-12 shadow-sm">
          <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-8">
            <div className="p-3 bg-blue-50 rounded-xl">
              <BookOpen className="w-8 h-8 text-blue-500" />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight capitalize text-slate-900">
              {params.slug.replace(/-/g, ' ')}
            </h1>
          </div>
          
          <div className="prose prose-slate prose-lg max-w-none 
            prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-900
            prose-a:text-blue-600 hover:prose-a:text-blue-800
            prose-code:text-pink-600 prose-code:bg-slate-50 prose-code:px-1 prose-code:rounded
            prose-pre:bg-slate-900 prose-pre:text-slate-50
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        </article>
      </div>
    </div>
  );
}
