"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

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
    const res = await fetch("/api/proxy/llm-providers");
    const data = await res.json();
    setProviders(data);
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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">模型管理</h1>
          <p className="text-gray-500 mt-1">配置和管理大语言模型提供商</p>
        </div>
        <Button onClick={() => { resetForm(); setShowDialog(true); }}>
          + 添加模型
        </Button>
      </div>

      <div className="grid gap-4">
        {providers.map((provider) => (
          <Card key={provider.id} className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-lg">{provider.name}</h3>
                  {provider.isDefault && <Badge>默认</Badge>}
                  {!provider.enabled && <Badge variant="secondary">已禁用</Badge>}
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  {PROVIDER_LABELS[provider.provider]}
                </p>
                <div className="text-sm text-gray-500">
                  <span className="font-medium">可用模型：</span>
                  {provider.models.length > 0 ? provider.models.join(", ") : "未配置"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEdit(provider)}>
                  编辑
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(provider.id)}>
                  删除
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {providers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            暂无模型配置，点击"添加模型"开始配置
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProvider ? "编辑模型" : "添加模型"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>名称</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：OpenAI GPT-4"
                required
              />
            </div>

            <div>
              <Label>提供商</Label>
              <select
                className="w-full border rounded px-3 py-2"
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value as ProviderType })}
              >
                {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <Label>API Key</Label>
              <Input
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="sk-..."
                required
              />
            </div>

            <div>
              <Label>Base URL（可选）</Label>
              <Input
                value={formData.baseUrl}
                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
            </div>

            <div>
              <Label>可用模型（逗号分隔）</Label>
              <Input
                value={formData.models}
                onChange={(e) => setFormData({ ...formData, models: e.target.value })}
                placeholder="gpt-4, gpt-3.5-turbo"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                />
                设为默认
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
                启用
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                取消
              </Button>
              <Button type="submit">
                {editingProvider ? "保存" : "创建"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
