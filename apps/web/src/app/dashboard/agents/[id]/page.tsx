import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import AgentDetailClient from "./AgentDetailClient";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

interface Agent {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "PAUSED" | "DELETED";
  colorIdx: number;
  model: string;
  agentsMd: string;
  gateway: { name: string; status: string };
  _count: { sessions: number; documents: number; skillBindings: number; mcpBindings: number };
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value ?? "";

  const res = await fetch(`${BACKEND_URL}/api/agents/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) notFound();

  const data = await res.json() as { success: boolean; data?: { agent: Agent } };
  if (!data.success || !data.data?.agent) notFound();

  return <AgentDetailClient agent={data.data.agent} />;
}
