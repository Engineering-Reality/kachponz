import { DocsSidebar } from "@/components/DocsSidebar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-[#FAFAFA] text-slate-900">
      <DocsSidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
