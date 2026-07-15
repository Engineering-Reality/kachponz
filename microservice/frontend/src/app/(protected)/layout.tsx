import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();
  if (!session) redirect("/login");
  return <>{children}</>;
}
