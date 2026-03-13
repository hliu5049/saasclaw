import * as React from "react"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAgents } from "@/store/agents"
import { useModels } from "@/store/models"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Trash2, Settings, Bot, Loader2, Sparkles, MessageSquare, Zap } from "lucide-react"

export function Agents() {
  const navigate = useNavigate()
  const { agents, isLoading, fetchAgents, addAgent, deleteAgent } = useAgents()
  const { models, fetchModels } = useModels()
  const [isAddOpen, setIsAddOpen] = useState(false)

  const defaultFormData = {
    name: "",
    description: "",
    soulMd: "",
    model: "",
    colorIdx: 0,
  }
  const [formData, setFormData] = useState(defaultFormData)

  useEffect(() => {
    fetchAgents()
    fetchModels()
  }, [fetchAgents, fetchModels])

  const activeModels = models.filter((m) => m.enabled)

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const newId = await addAgent(formData)
      setIsAddOpen(false)
      setFormData(defaultFormData)
      navigate(`/agents/${newId}`)
    } catch (error) {
      // Error already handled in store
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此 Agent？")) return
    await deleteAgent(id)
  }

  const getModelName = (modelString: string) => {
    // modelString format: "provider/model-name"
    return modelString || "Unknown Model"
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge variant="success">Running</Badge>
      case "PAUSED":
        return <Badge variant="secondary">Paused</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  if (isLoading && agents.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
          <p className="text-zinc-500">Manage your AI agents and their capabilities.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
              <DialogDescription>
                Set up the basic identity and behavior of your agent.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Agent Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Data Analyst"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the agent"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="soulMd">SOUL.md (System Prompt)</Label>
                <Textarea
                  id="soulMd"
                  value={formData.soulMd}
                  onChange={(e) => setFormData({ ...formData, soulMd: e.target.value })}
                  placeholder="# Role&#10;You are an expert data analyst...&#10;&#10;# Principles&#10;- Be helpful&#10;- Be concise"
                  rows={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Base Model</Label>
                <Select
                  value={formData.model}
                  onValueChange={(val) => setFormData({ ...formData, model: val })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeModels.flatMap((m) =>
                      m.models.filter(Boolean).map((modelName) => (
                        <SelectItem key={`${m.id}-${modelName}`} value={`${m.provider.toLowerCase()}/${modelName}`}>
                          {m.name} - {modelName}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {activeModels.length === 0 && (
                  <p className="text-xs text-yellow-600">
                    No active models found. Please add a model first.
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button type="submit" disabled={activeModels.length === 0}>
                  Create Agent
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => {
          const colorIdx = agent.colorIdx % 10
          const colors = [
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
          ]
          const emojis = ["🤖", "🧠", "⚡", "🔧", "💡", "🌟", "🎯", "🔬", "📊", "🚀"]
          
          return (
            <Card key={agent.id} className="flex flex-col hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/agents/${agent.id}`)}>
              <div className={`h-2 bg-gradient-to-r ${colors[colorIdx]}`} />
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[colorIdx]} flex items-center justify-center text-xl`}>
                      {emojis[colorIdx]}
                    </div>
                    <div>
                      <div className="font-semibold">{agent.name}</div>
                      <CardDescription className="text-xs truncate max-w-[150px]" title={agent.description}>
                        {agent.description || "No description"}
                      </CardDescription>
                    </div>
                  </CardTitle>
                </div>
                {getStatusBadge(agent.status)}
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  <Sparkles className="h-4 w-4" />
                  <span className="truncate">{getModelName(agent.model)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-zinc-600">
                    <MessageSquare className="h-4 w-4" />
                    <span>{agent._count?.sessions || 0} sessions</span>
                  </div>
                  <div className="flex items-center gap-1 text-zinc-600">
                    <Zap className="h-4 w-4" />
                    <span>{agent._count?.mcpBindings || 0} tools</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2 border-t pt-4">
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/agents/${agent.id}`); }}>
                  <Settings className="mr-2 h-4 w-4 text-zinc-500" /> Manage
                </Button>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(agent.id); }} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </CardFooter>
            </Card>
          )
        })}
        {agents.length === 0 && !isLoading && (
          <div className="col-span-full py-12 text-center text-zinc-500 border rounded-xl border-dashed">
            No agents found. Create one to get started.
          </div>
        )}
      </div>
    </div>
  )
}
