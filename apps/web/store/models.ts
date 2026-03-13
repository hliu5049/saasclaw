import { create } from "zustand"
import { api } from "@/lib/api"
import { toast } from "sonner"

export type Model = {
  id: string
  name: string
  provider: string
  apiKey: string
  baseUrl?: string
  models: string[]
  isDefault: boolean
  enabled: boolean
  createdAt: string
  updatedAt: string
}

type ModelsState = {
  models: Model[]
  isLoading: boolean
  error: string | null
  fetchModels: () => Promise<void>
  addModel: (model: Omit<Model, "id" | "createdAt" | "updatedAt">) => Promise<void>
  updateModel: (id: string, model: Partial<Model>) => Promise<void>
  deleteModel: (id: string) => Promise<void>
  toggleStatus: (id: string) => Promise<void>
}

export const useModels = create<ModelsState>((set, get) => ({
  models: [],
  isLoading: false,
  error: null,

  fetchModels: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await api.getModels()
      // Backend returns array directly
      const models = Array.isArray(data) ? data : []
      set({ models, isLoading: false })
    } catch (error: any) {
      console.error("Failed to fetch models:", error)
      set({ error: error.message, isLoading: false })
      toast.error("Failed to load models")
    }
  },

  addModel: async (model) => {
    try {
      await api.createModel(model)
      toast.success("Model added successfully")
      // Refresh list
      await get().fetchModels()
    } catch (error: any) {
      console.error("Failed to add model:", error)
      toast.error(error.message || "Failed to add model")
      throw error
    }
  },

  updateModel: async (id, updatedModel) => {
    try {
      await api.updateModel(id, updatedModel)
      toast.success("Model updated successfully")
      // Refresh list
      await get().fetchModels()
    } catch (error: any) {
      console.error("Failed to update model:", error)
      toast.error(error.message || "Failed to update model")
      throw error
    }
  },

  deleteModel: async (id) => {
    try {
      await api.deleteModel(id)
      toast.success("Model deleted successfully")
      // Remove from local state
      set((state) => ({
        models: state.models.filter((m) => m.id !== id),
      }))
    } catch (error: any) {
      console.error("Failed to delete model:", error)
      toast.error(error.message || "Failed to delete model")
      throw error
    }
  },

  toggleStatus: async (id) => {
    const model = get().models.find((m) => m.id === id)
    if (!model) return

    try {
      const newStatus = !model.enabled
      await api.updateModel(id, { enabled: newStatus })
      toast.success(`Model ${newStatus ? "enabled" : "disabled"} successfully`)
      // Update local state
      set((state) => ({
        models: state.models.map((m) =>
          m.id === id ? { ...m, enabled: newStatus } : m
        ),
      }))
    } catch (error: any) {
      console.error("Failed to toggle model status:", error)
      toast.error(error.message || "Failed to update model status")
      throw error
    }
  },
}))
