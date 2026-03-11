import ChatInterface from "@/app/chat/[agentId]/ChatInterface";

export default async function AgentChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ChatInterface
      agentId={id}
      backHref={`/dashboard/agents/${id}`}
    />
  );
}
