"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Cpu, 
  Edit, 
  Trash2, 
  Star, 
  CheckCircle2, 
  XCircle,
  Sparkles,
  Brain,
  Zap
} from "lucide-react";

type ProviderType = "ANTHROPIC" | "OPENAI" | "AZURE_OPENAI" | "GOOGLE" | "CUSTOM";

interface LlmProvider {
  id: string;
  name: string;
  provider: ProviderType;
  apiKey: string;
  baseUrl?: string;
  models: string[];
  isDefault: boolean;
  enabled: boolean;
}

const PROVIDER_LABELS: Record<ProviderType, string> = {
  ANTHROPIC: "Anthropic",
  OPENAI: "OpenAI",
  AZURE_OPENAI: "Azure OpenAI",
  GOOGLE: "Google",
  CUSTOM: "Custom",
};

const PROVIDER_ICONS: Record<ProviderType, React.ReactNode> = {
  ANTHROPIC: <Brain className="h-5 w-5" />,
  OPENAI: <Sparkles className="h-5 w-5" />,
  AZURE_OPENAI: <Cpu className="h-5 w-5" />,
  GOOGLE: <Zap className="h-5 w-5" />,
  CUSTOM: <Cpu className="h-5 w-5" />,
};

export default function LlmProvidersPage() {
  const [providers, setProviders] = useState<LlmProvider[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LlmProvider | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    provider: "OPENAI" as ProviderType,
    apiKey: "",
    baseUrl: "",
    models: "",
    isDefault: false,
    enabled: true,
  });

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const res = await fetch("/api/proxy/llm-providers");
      const data = await res.json();
      if (Array.isArray(data)) {
        setProviders(data);
      } else {
        console.error("Invalid response format:", data);
        setProviders([]);
      }
    } catch (error) {
      console.error("Failed to load providers:", error);
      setProviders([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      ...formData,
      models: formData.models.split(",").map(m => m.trim()).filter(Boolean),
    };

    if (editingProvider) {
      await fetch(`/api/proxy/llm-providers/${editingProvider.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/proxy/llm-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setShowDialog(false);
    setEditingProvider(null);
    resetForm();
    loadProviders();
  };

  const handleEdit = (provider: LlmProvider) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      provider: provider.provider,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl || "",
      models: provider.models.join(", "),
      isDefault: provider.isDefault,
      enabled: provider.enabled,
    });
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此模型配置？")) return;
    await fetch(`/api/proxy/llm-providers/${id}`, { method: "DELETE" });
    loadProviders();
  };

  const resetForm = () => {
    setFormData({
      name: "",
      provider: "OPENAI",
      apiKey: "",
      baseUrl: "",
      models: "",
      isDefault: false,
      enabled: true,
    });
  };

  return (
    <div className="flex-1 overflow-auto bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto p-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Cpu className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">模型管理</h1>
              <p className="text-muted-foreground mt-1">配置和管理大语言模型提供商</p>
            </div>
          </div>
        </div>

        {/* Add Button */}
        <div className="mb-6">
          <Button onClick={() => { resetForm(); setShowDialog(true); }} size="lg" className="gap-2">
            <Plus className="h-4 w-4" />
            添加模型提供商
          </Button>
        </div>

        {/* Providers Grid */}
        {!Array.isArray(providers) || providers.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Cpu className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">暂无模型配置</h3>
              <p className="text-muted-foreground mb-4">开始添加您的第一个模型提供商</p>
              <Button onClick={() => { resetForm(); setShowDialog(true); }} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                添加模型
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {providers.map((provider) => (
              <Card key={provider.id} className="relative overflow-hidden hover:shadow-lg transition-shadow">
                {provider.isDefault && (
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-yellow-500 to-yellow-600 text-white px-3 py-1 text-xs font-medium flex items-center gap-1">
                    <Star className="h-3 w-3 fill-current" />
                    默认
                  </div>
                )}
                
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        {PROVIDER_ICONS[provider.provider]}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{provider.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          {PROVIDER_LABELS[provider.provider]}
                          {provider.enabled ? (
                            <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                              <CheckCircle2 className="h-3 w-3" />
                              已启用
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-gray-500 border-gray-500">
                              <XCircle className="h-3 w-3" />
                              已禁用
                            </Badge>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">可用模型</p>
                      <div className="flex flex-wrap gap-1">
                        {provider.models.length > 0 ? (
                          provider.models.map((model, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {model}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">未配置</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleEdit(provider)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        编辑
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(provider.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingProvider ? "编辑模型提供商" : "添加模型提供商"}</DialogTitle>
              <DialogDescription>
                配置大语言模型的API密钥和可用模型列表
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">名称</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例如：OpenAI GPT-4"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="provider">提供商类型</Label>
                  <Select
                    value={formData.provider}
                    onValueChange={(value) => setFormData({ ...formData, provider: value as ProviderType })}
                  >
                    <SelectTrigger id="provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
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

                <div className="grid gap-2">
                  <Label htmlFor="baseUrl">Base URL（可选）</Label>
                  <Input
                    id="baseUrl"
                    value={formData.baseUrl}
                    onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="models">可用模型（逗号分隔）</Label>
                  <Input
                    id="models"
                    value={formData.models}
                    onChange={(e) => setFormData({ ...formData, models: e.target.value })}
                    placeholder="gpt-4, gpt-3.5-turbo"
                  />
                  <p className="text-xs text-muted-foreground">
                    输入多个模型名称，用逗号分隔
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="isDefault">设为默认</Label>
                    <p className="text-sm text-muted-foreground">
                      创建新Agent时默认使用此提供商
                    </p>
                  </div>
                  <Switch
                    id="isDefault"
                    checked={formData.isDefault}
                    onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="enabled">启用</Label>
                    <p className="text-sm text-muted-foreground">
                      是否在Agent创建时显示此提供商
                    </p>
                  </div>
                  <Switch
                    id="enabled"
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                  取消
                </Button>
                <Button type="submit">
                  {editingProvider ? "保存更改" : "创建"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
