import * as React from "react"
import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useAgents } from "@/store/agents"
import { useModels } from "@/store/models"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Save, Bot, MessageSquare, Settings } from "lucide-react"
import { ChatPanel } from "@/components/chat-panel"

export function AgentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { agents, isLoading, updateAgent, fetchAgents } = useAgents()
  const { models, fetchModels } = useModels()

  const agent = agents.find(a => a.id === id)
  const activeModels = models.filter((m) => m.enabled)

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    soulMd: "",
    agentsMd: "",
    model: "",
    status: "ACTIVE" as const,
    colorIdx: 0,
  })

  useEffect(() => {
    if (agents.length === 0) {
      fetchAgents()
      fetchModels()
    }
  }, [])

  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name,
        description: agent.description || "",
        soulMd: agent.soulMd || "",
        agentsMd: agent.agentsMd || "",
        model: agent.model || "",
        status: agent.status,
        colorIdx: agent.colorIdx || 0,
      })
    }
  }, [agent])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-700" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <h2 className="text-2xl font-bold">Agent not found</h2>
        <Button onClick={() => navigate("/agents")}>Back to Agents</Button>
      </div>
    )
  }

  const handleSave = async () => {
    if (id) {
      try {
        const { status, ...updateData } = formData
        await updateAgent(id, updateData)
      } catch (error) {
        // Error already handled in store
      }
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate("/agents")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-8 w-8 text-zinc-500" />
            {agent.name}
          </h1>
          <p className="text-zinc-500">Configure agent identity and chat with it.</p>
        </div>
      </div>

      <Tabs defaultValue="configure">
        <TabsList>
          <TabsTrigger value="configure" className="flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Configure
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
          </TabsTrigger>
        </TabsList>

        {/* ── Configure tab ── */}
        <TabsContent value="configure">
          <div className="flex justify-end mb-4">
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>Update the agent's core identity and instructions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Agent Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Data Analyst"
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
                      className="min-h-[150px]"
                      value={formData.soulMd}
                      onChange={(e) => setFormData({ ...formData, soulMd: e.target.value })}
                      placeholder="# Role&#10;You are an expert data analyst...&#10;&#10;# Principles&#10;- Be helpful&#10;- Be concise"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agentsMd">AGENTS.md (Initial Memory)</Label>
                    <Textarea
                      id="agentsMd"
                      className="min-h-[100px]"
                      value={formData.agentsMd}
                      onChange={(e) => setFormData({ ...formData, agentsMd: e.target.value })}
                      placeholder="Long-term memory and context for the agent..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Base Model</Label>
                    <Select
                      value={formData.model}
                      onValueChange={(val) => setFormData({ ...formData, model: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeModels.flatMap((m) =>
                          m.models.filter(Boolean).map((modelName) => (
                            <SelectItem
                              key={`${m.id}-${modelName}`}
                              value={`${m.provider.toLowerCase()}/${modelName}`}
                            >
                              {m.name} - {modelName}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Agent Status</CardTitle>
                  <CardDescription>Current status of this agent.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between space-x-2">
                    <div className="flex flex-col space-y-1">
                      <Label>Status</Label>
                      <span className="text-sm text-zinc-500">
                        {formData.status === "ACTIVE" ? "Agent is running" : "Agent is paused"}
                      </span>
                    </div>
                    <Badge variant={formData.status === "ACTIVE" ? "success" : "secondary"}>
                      {formData.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── Chat tab ── */}
        <TabsContent value="chat">
          <ChatPanel agentId={agent.id} agentName={agent.name} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
