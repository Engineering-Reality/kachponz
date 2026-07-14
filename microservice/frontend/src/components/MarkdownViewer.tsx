'use client';

import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';
import { AlertCircle, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#171717',
    primaryTextColor: '#fff',
    primaryBorderColor: '#6366f1',
    lineColor: '#6366f1',
    secondaryColor: '#ec4899',
    tertiaryColor: '#22d3ee'
  }
});

function MermaidDiagram({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      try {
        const id = 'mermaid-svg-' + Math.random().toString(36).substr(2, 9);
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        if (isMounted) {
          setSvg(renderedSvg);
        }
      } catch (err) {
        console.error('Mermaid render error:', err);
      }
    };
    renderChart();
    return () => { isMounted = false; };
  }, [chart]);

  return (
    <div 
      ref={ref} 
      className="my-8 flex justify-center bg-[#0a0a0a] p-8 rounded-2xl border border-white/10 shadow-xl overflow-x-auto overflow-y-hidden"
      dangerouslySetInnerHTML={{ __html: svg }} 
    />
  );
}

// Simple parser for GitHub style alerts
function parseAlert(text: string) {
  const match = text.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*([\s\S]*)/i);
  if (!match) return null;
  return { type: match[1].toUpperCase(), content: match[2] };
}

export default function MarkdownViewer({ content }: { content: string }) {
  return (
    <div className="prose prose-slate prose-lg max-w-none prose-headings:font-extrabold prose-headings:tracking-tight prose-headings:text-slate-900 prose-a:text-indigo-600 hover:prose-a:text-indigo-800 prose-blockquote:border-l-4 prose-blockquote:border-indigo-500 prose-blockquote:bg-indigo-50 prose-blockquote:py-1 prose-blockquote:px-6 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-slate-700 prose-th:bg-slate-100 prose-th:px-4 prose-th:py-3 prose-th:border prose-th:border-slate-200 prose-td:px-4 prose-td:py-3 prose-td:border prose-td:border-slate-200 prose-table:border-collapse prose-table:w-full">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const {children, className, node, ref, ...rest} = props
            const match = /language-(\w+)/.exec(className || '')
            const isMermaid = match && match[1] === 'mermaid';
            
            if (isMermaid && typeof children === 'string') {
              return <MermaidDiagram chart={children} />
            }
            
            if (match) {
              return (
                <div className="rounded-xl overflow-hidden shadow-2xl my-6 border border-[#2d2d2d] bg-[#1e1e1e]">
                  <div className="bg-[#252526] px-4 py-2.5 text-xs font-sans text-[#cccccc] border-b border-[#3c3c3c] flex items-center justify-between">
                    <span className="font-semibold tracking-wide">{match[1]}</span>
                    <div className="flex gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
                    </div>
                  </div>
                  <SyntaxHighlighter
                    {...rest}
                    PreTag="div"
                    children={String(children).replace(/\n$/, '')}
                    language={match[1]}
                    style={vscDarkPlus}
                    customStyle={{ margin: 0, padding: '1.25rem 1.5rem', background: '#1e1e1e', fontSize: '0.85rem' }}
                  />
                </div>
              )
            }
            
            return (
              <code {...rest} className="text-[#e83e8c] bg-slate-100/80 px-1.5 py-0.5 rounded text-[0.9em] font-mono border border-slate-200 break-words">
                {children}
              </code>
            )
          },
          blockquote(props) {
            const childrenArray = React.Children.toArray(props.children);
            
            let isAlert = false;
            let alertType = '';
            
            const processedChildren = React.Children.map(childrenArray, (child) => {
              if (React.isValidElement(child) && child.type === 'p') {
                const pChildren = React.Children.toArray((child.props as { children?: React.ReactNode }).children);
                if (pChildren.length > 0 && typeof pChildren[0] === 'string') {
                  const alertMatch = parseAlert(pChildren[0]);
                  if (alertMatch) {
                    isAlert = true;
                    alertType = alertMatch.type;
                    const newFirstChild = alertMatch.content;
                    const newPChildren = [newFirstChild, ...pChildren.slice(1)];
                    return React.cloneElement(child as React.ReactElement, {}, ...newPChildren);
                  }
                }
              }
              return child;
            });
            
            if (isAlert) {
              const alertStyles: Record<string, { bg: string, border: string, text: string, icon: React.ReactNode }> = {
                'NOTE': { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-800', icon: <Info className="w-5 h-5 text-blue-600 mt-0.5" /> },
                'TIP': { bg: 'bg-green-50', border: 'border-green-500', text: 'text-green-800', icon: <Info className="w-5 h-5 text-green-600 mt-0.5" /> },
                'IMPORTANT': { bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-800', icon: <AlertCircle className="w-5 h-5 text-purple-600 mt-0.5" /> },
                'WARNING': { bg: 'bg-orange-50', border: 'border-orange-500', text: 'text-orange-800', icon: <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" /> },
                'CAUTION': { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-800', icon: <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5" /> },
              };
              
              const style = alertStyles[alertType] || alertStyles['NOTE'];
              const titleCase = alertType.charAt(0) + alertType.slice(1).toLowerCase();
              
              return (
                <div className={`my-6 flex gap-3 p-4 rounded-xl border-l-4 ${style.border} ${style.bg} ${style.text}`}>
                  <div className="flex-shrink-0">{style.icon}</div>
                  <div className="flex-1 m-0 [&>p]:m-0 [&>p]:leading-relaxed text-[15px]">
                    <div className="font-bold mb-1">{titleCase}</div>
                    {processedChildren}
                  </div>
                </div>
              );
            }
            
            return <blockquote {...props}>{props.children}</blockquote>;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
