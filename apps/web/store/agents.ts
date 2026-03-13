import { create } from "zustand"
import { api } from "@/lib/api"
import { toast } from "sonner"

export type Agent = {
  id: string
  name: string
  description?: string
  soulMd: string
  model: string
  status: "ACTIVE" | "PAUSED" | "DELETED"
  colorIdx: number
  workspacePath: string
  gatewayId: string
  ownerId: string
  createdAt: string
  updatedAt: string
  _count?: {
    sessions: number
    mcpBindings: number
    skillBindings: number
  }
}

type AgentsState = {
  agents: Agent[]
  isLoading: boolean
  error: string | null
  fetchAgents: () => Promise<void>
  addAgent: (agent: any) => Promise<string>
  updateAgent: (id: string, agent: Partial<Agent>) => Promise<void>
  deleteAgent: (id: string) => Promise<void>
  getAgent: (id: string) => Promise<Agent | null>
}

export const useAgents = create<AgentsState>((set, get) => ({
  agents: [],
  isLoading: false,
  error: null,

  fetchAgents: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await api.getAgents()
      const agents = response.success ? response.data.agents : []
      set({ agents, isLoading: false })
    } catch (error: any) {
      console.error("Failed to fetch agents:", error)
      set({ error: error.message, isLoading: false })
      toast.error("Failed to load agents")
    }
  },

  addAgent: async (agent) => {
    try {
      const response = await api.createAgent(agent)
      if (response.success) {
        toast.success("Agent created successfully")
        // Refresh list
        await get().fetchAgents()
        return response.data.agent.id
      }
      throw new Error("Failed to create agent")
    } catch (error: any) {
      console.error("Failed to add agent:", error)
      toast.error(error.message || "Failed to create agent")
      throw error
    }
  },

  updateAgent: async (id, updatedAgent) => {
    try {
      await api.updateAgent(id, updatedAgent)
      toast.success("Agent updated successfully")
      // Refresh list
      await get().fetchAgents()
    } catch (error: any) {
      console.error("Failed to update agent:", error)
      toast.error(error.message || "Failed to update agent")
      throw error
    }
  },

  deleteAgent: async (id) => {
    try {
      await api.deleteAgent(id)
      toast.success("Agent deleted successfully")
      // Remove from local state
      set((state) => ({
        agents: state.agents.filter((a) => a.id !== id),
      }))
    } catch (error: any) {
      console.error("Failed to delete agent:", error)
      toast.error(error.message || "Failed to delete agent")
      throw error
    }
  },

  getAgent: async (id) => {
    try {
      const response = await api.getAgent(id)
      if (response.success) {
        return response.data.agent
      }
      return null
    } catch (error: any) {
      console.error("Failed to get agent:", error)
      toast.error(error.message || "Failed to load agent")
      return null
    }
  },
}))
