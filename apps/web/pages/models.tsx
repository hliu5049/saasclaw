import * as React from "react"
import { useState, useEffect } from "react"
import { useModels, Model } from "@/store/models"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Edit, Trash2, Power, PowerOff, Box, Loader2, Star } from "lucide-react"

const PROVIDER_TYPES = [
  { value: "ANTHROPIC", label: "Anthropic" },
  { value: "OPENAI", label: "OpenAI" },
  { value: "AZURE_OPENAI", label: "Azure OpenAI" },
  { value: "GOOGLE", label: "Google" },
  { value: "CUSTOM", label: "Custom" },
]

export function Models() {
  const { models, isLoading, fetchModels, addModel, updateModel, deleteModel, toggleStatus } = useModels()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<Model | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    provider: "OPENAI",
    apiKey: "",
    baseUrl: "",
    models: "",
    isDefault: false,
    enabled: true,
  })

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await addModel({
        ...formData,
        models: formData.models.split(",").map(m => m.trim()).filter(Boolean),
      })
      setIsAddOpen(false)
      setFormData({ name: "", provider: "OPENAI", apiKey: "", baseUrl: "", models: "", isDefault: false, enabled: true })
    } catch (error) {
      // Error already handled in store
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingModel) {
      try {
        await updateModel(editingModel.id, {
          ...formData,
          models: formData.models.split(",").map(m => m.trim()).filter(Boolean),
        })
        setIsEditOpen(false)
        setEditingModel(null)
      } catch (error) {
        // Error already handled in store
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此模型配置？")) return
    await deleteModel(id)
  }

  const handleToggleStatus = async (id: string) => {
    await toggleStatus(id)
  }

  const openEdit = (model: Model) => {
    setEditingModel(model)
    setFormData({
      name: model.name,
      provider: model.provider,
      apiKey: model.apiKey,
      baseUrl: model.baseUrl || "",
      models: model.models.join(", "),
      isDefault: model.isDefault,
      enabled: model.enabled,
    })
    setIsEditOpen(true)
  }

  if (isLoading && models.length === 0) {
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
          <h1 className="text-3xl font-bold tracking-tight">Models</h1>
          <p className="text-zinc-500">Manage your AI models and providers.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Model
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Model</DialogTitle>
              <DialogDescription>
                Configure a new AI model provider to use with your agents.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Provider Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. OpenAI GPT-4"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider">Provider Type</Label>
                <Select
                  value={formData.provider}
                  onValueChange={(val) => setFormData({ ...formData, provider: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="sk-..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL (Optional)</Label>
                <Input
                  id="baseUrl"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="models">Available Models (comma-separated)</Label>
                <Input
                  id="models"
                  value={formData.models}
                  onChange={(e) => setFormData({ ...formData, models: e.target.value })}
                  placeholder="gpt-4, gpt-3.5-turbo"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  />
                  Set as default
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  />
                  Enabled
                </label>
              </div>
              <DialogFooter>
                <Button type="submit">Add Model</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {models.map((model) => (
          <Card key={model.id} className="flex flex-col">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Box className="h-5 w-5 text-zinc-500" />
                  {model.name}
                  {model.isDefault && <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />}
                </CardTitle>
                <CardDescription className="truncate max-w-[200px]" title={model.provider}>
                  {model.provider}
                </CardDescription>
              </div>
              <Badge variant={model.enabled ? "success" : "secondary"}>
                {model.enabled ? "Active" : "Disabled"}
              </Badge>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-2">
                {model.baseUrl && (
                  <div className="text-sm text-zinc-500 truncate" title={model.baseUrl}>
                    {model.baseUrl}
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  {model.models.map((m, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 border-t pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleToggleStatus(model.id)}
                title={model.enabled ? "Disable" : "Enable"}
              >
                {model.enabled ? (
                  <><PowerOff className="mr-2 h-4 w-4 text-zinc-500" /> Disable</>
                ) : (
                  <><Power className="mr-2 h-4 w-4 text-emerald-500" /> Enable</>
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => openEdit(model)}>
                <Edit className="mr-2 h-4 w-4 text-zinc-500" /> Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(model.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </CardFooter>
          </Card>
        ))}
        {models.length === 0 && !isLoading && (
          <div className="col-span-full py-12 text-center text-zinc-500 border rounded-xl border-dashed">
            No models found. Add one to get started.
          </div>
        )}
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Model</DialogTitle>
            <DialogDescription>
              Update the configuration for this model provider.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Provider Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-provider">Provider Type</Label>
              <Select
                value={formData.provider}
                onValueChange={(val) => setFormData({ ...formData, provider: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-apiKey">API Key</Label>
              <Input
                id="edit-apiKey"
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-baseUrl">Base URL (Optional)</Label>
              <Input
                id="edit-baseUrl"
                value={formData.baseUrl}
                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-models">Available Models (comma-separated)</Label>
              <Input
                id="edit-models"
                value={formData.models}
                onChange={(e) => setFormData({ ...formData, models: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                />
                Set as default
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
                Enabled
              </label>
            </div>
            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}