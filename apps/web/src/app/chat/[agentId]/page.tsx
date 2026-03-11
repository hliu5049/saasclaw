import ChatInterface from "./ChatInterface";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  return <ChatInterface agentId={agentId} />;
}
