import * as React from "react"
import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useAgents } from "@/store/agents"
import { useModels } from "@/store/models"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Save, Bot, BrainCircuit, Database, Wrench, Network } from "lucide-react"

export function AgentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { agents, updateAgent } = useAgents()
  const { models } = useModels()
  
  const agent = agents.find(a => a.id === id)
  const activeModels = models.filter((m) => m.status === "active")

  const [formData, setFormData] = useState(agent || {
    id: "",
    name: "",
    persona: "",
    prompt: "",
    modelId: "",
    status: "stopped" as const,
    tasksExecuted: 0,
    config: { mcp: false, skill: false, memory: false, rag: false },
  })

  useEffect(() => {
    if (agent) {
      setFormData(agent)
    }
  }, [agent])

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <h2 className="text-2xl font-bold">Agent not found</h2>
        <Button onClick={() => navigate("/agents")}>Back to Agents</Button>
      </div>
    )
  }

  const handleSave = () => {
    if (id) {
      updateAgent(id, formData)
      toast.success("Agent settings saved successfully")
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/agents")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Bot className="h-8 w-8 text-zinc-500" />
              {agent.name}
            </h1>
            <p className="text-zinc-500">Configure agent identity and advanced capabilities.</p>
          </div>
        </div>
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
                <Label htmlFor="persona">Persona</Label>
                <Input
                  id="persona"
                  value={formData.persona}
                  onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
                  placeholder="e.g. You are an expert data analyst."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prompt">System Prompt</Label>
                <Textarea
                  id="prompt"
                  className="min-h-[150px]"
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  placeholder="Instructions for the agent..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Base Model</Label>
                <Select
                  value={formData.modelId}
                  onValueChange={(val) => setFormData({ ...formData, modelId: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Capabilities</CardTitle>
              <CardDescription>Enable advanced features for this agent.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between space-x-2">
                <div className="flex flex-col space-y-1">
                  <Label className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-zinc-500" />
                    RAG
                  </Label>
                  <span className="text-xs text-zinc-500">Retrieval-Augmented Generation</span>
                </div>
                <Switch
                  checked={formData.config.rag}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, config: { ...formData.config, rag: checked } })
                  }
                />
              </div>
              
              <div className="flex items-center justify-between space-x-2">
                <div className="flex flex-col space-y-1">
                  <Label className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-zinc-500" />
                    Skills
                  </Label>
                  <span className="text-xs text-zinc-500">Enable external tool usage</span>
                </div>
                <Switch
                  checked={formData.config.skill}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, config: { ...formData.config, skill: checked } })
                  }
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="flex flex-col space-y-1">
                  <Label className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-zinc-500" />
                    MCP
                  </Label>
                  <span className="text-xs text-zinc-500">Model Context Protocol</span>
                </div>
                <Switch
                  checked={formData.config.mcp}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, config: { ...formData.config, mcp: checked } })
                  }
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="flex flex-col space-y-1">
                  <Label className="flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 text-zinc-500" />
                    Memory
                  </Label>
                  <span className="text-xs text-zinc-500">Long-term conversation memory</span>
                </div>
                <Switch
                  checked={formData.config.memory}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, config: { ...formData.config, memory: checked } })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
