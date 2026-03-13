"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Bot, 
  Plus, 
  Search, 
  MessageSquare, 
  Zap, 
  Loader2,
  Sparkles,
  TrendingUp,
  Users
} from "lucide-react";
import CreateAgentWizard from "./CreateAgentWizard";

interface AgentSummary {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "PAUSED" | "DELETED";
  colorIdx: number;
  model: string;
  _count: { sessions: number; mcpBindings: number };
}

const AGENT_COLORS = [
  "from-blue-500 to-cyan-500",
  "from-purple-500 to-pink-500",
  "from-emerald-500 to-teal-500",
  "from-orange-500 to-red-500",
  "from-indigo-500 to-purple-500",
  "from-violet-500 to-fuchsia-500",
  "from-cyan-500 to-blue-500",
  "from-yellow-500 to-orange-500",
  "from-slate-500 to-gray-500",
  "from-rose-500 to-pink-500",
];

const EMOJIS = ["🤖", "🧠", "⚡", "🔧", "💡", "🌟", "🎯", "🔬", "📊", "🚀"];

export default function DashboardPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/proxy/api/agents");
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      if (data.success) setAgents(data.data?.agents ?? []);
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: agents.length,
    active: agents.filter(a => a.status === "ACTIVE").length,
    totalSessions: agents.reduce((sum, a) => sum + a._count.sessions, 0),
  };

  return (
    <div className="flex-1 overflow-auto bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto p-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">AI Agent 控制台</h1>
              <p className="text-muted-foreground">管理和监控您的智能助手</p>
            </div>
            <CreateAgentWizard
              trigger={
                <Button size="lg" className="gap-2">
                  <Plus className="h-5 w-5" />
                  创建 Agent
                </Button>
              }
              onCreated={fetchAgents}
            />
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总 Agent 数</CardTitle>
                <Bot className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.active} 个运行中
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总会话数</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalSessions}</div>
                <p className="text-xs text-muted-foreground">
                  跨所有 Agent
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">活跃率</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Agent 在线比例
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索 Agent..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Agents Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredAgents.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Bot className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {search ? "未找到匹配的 Agent" : "还没有 Agent"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {search ? "尝试其他搜索词" : "创建您的第一个智能助手"}
              </p>
              {!search && (
                <CreateAgentWizard
                  trigger={
                    <Button variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      创建 Agent
                    </Button>
                  }
                  onCreated={fetchAgents}
                />
              )}
            </div>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.map((agent) => {
              const colorIdx = agent.colorIdx % AGENT_COLORS.length;
              const gradient = AGENT_COLORS[colorIdx];
              const emoji = EMOJIS[colorIdx % EMOJIS.length];

              return (
                <Card
                  key={agent.id}
                  className="group cursor-pointer hover:shadow-lg transition-all duration-200 overflow-hidden"
                  onClick={() => router.push(`/dashboard/agents/${agent.id}`)}
                >
                  <div className={`h-2 bg-gradient-to-r ${gradient}`} />
                  
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl shadow-lg`}>
                          {emoji}
                        </div>
                        <div>
                          <CardTitle className="text-lg group-hover:text-primary transition-colors">
                            {agent.name}
                          </CardTitle>
                          <CardDescription className="line-clamp-1">
                            {agent.description || "暂无描述"}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge
                        variant={agent.status === "ACTIVE" ? "default" : "secondary"}
                        className="shrink-0"
                      >
                        {agent.status === "ACTIVE" ? "运行中" : "已暂停"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Sparkles className="h-4 w-4" />
                        <span className="truncate">{agent.model}</span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MessageSquare className="h-4 w-4" />
                          <span>{agent._count.sessions} 会话</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Zap className="h-4 w-4" />
                          <span>{agent._count.mcpBindings} 工具</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
