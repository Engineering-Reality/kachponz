import fs from 'fs';
import path from 'path';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen } from 'lucide-react';
import { findDocTitle } from '@/content/docsNav';

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

export default async function DocViewer(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const docsDir = path.join(process.cwd(), 'src/content/docs');
  const filePath = path.join(docsDir, `${params.slug}.md`);

  if (!fs.existsSync(filePath)) {
    notFound();
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  return (
    <div className="p-8 lg:p-16 relative">
      <div className="absolute top-0 left-0 w-full h-[300px] opacity-20 bg-gradient-to-b from-slate-200 to-transparent pointer-events-none z-0"></div>

      <div className="relative z-10 max-w-3xl">
        <article className="bg-white border border-slate-200 rounded-2xl p-8 md:p-12 shadow-sm">
          <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-8">
            <div className="p-3 bg-blue-50 rounded-xl">
              <BookOpen className="w-8 h-8 text-blue-500" />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
              {findDocTitle(params.slug)}
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
