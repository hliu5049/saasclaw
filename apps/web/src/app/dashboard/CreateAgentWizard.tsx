"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Upload, X, Check, ChevronRight, ChevronLeft, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const STEP_LABELS = ["基本信息", "知识库", "MCP 工具", "技能", "渠道"];

const MODELS = [
  { value: "anthropic/claude-opus-4-6",    label: "Claude Opus 4.6" },
  { value: "anthropic/claude-sonnet-4-6",  label: "Claude Sonnet 4.6" },
  { value: "anthropic/claude-haiku-4-5",   label: "Claude Haiku 4.5" },
  { value: "openai/gpt-4o",                label: "GPT-4o" },
  { value: "openai/gpt-4o-mini",           label: "GPT-4o Mini" },
];

const COLOR_OPTIONS = [
  { idx: 0, bg: "bg-blue-500",    ring: "ring-blue-500",    label: "蓝" },
  { idx: 1, bg: "bg-violet-500",  ring: "ring-violet-500",  label: "紫" },
  { idx: 2, bg: "bg-emerald-500", ring: "ring-emerald-500", label: "绿" },
  { idx: 3, bg: "bg-orange-500",  ring: "ring-orange-500",  label: "橙" },
  { idx: 4, bg: "bg-red-500",     ring: "ring-red-500",     label: "红" },
  { idx: 5, bg: "bg-pink-500",    ring: "ring-pink-500",    label: "粉" },
  { idx: 6, bg: "bg-cyan-500",    ring: "ring-cyan-500",    label: "青" },
  { idx: 7, bg: "bg-yellow-500",  ring: "ring-yellow-500",  label: "黄" },
  { idx: 8, bg: "bg-slate-500",   ring: "ring-slate-500",   label: "灰" },
  { idx: 9, bg: "bg-indigo-500",  ring: "ring-indigo-500",  label: "靛" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface McpServer { id: string; name: string; description?: string | null; icon?: string | null; endpoint: string; }
interface Skill     { id: string; name: string; description?: string | null; icon?: string | null; version: string; }

interface WecomConfig {
  corpId: string; corpSecret: string; agentId: string;
  token: string; encodingAESKey: string;
}

interface WizardData {
  name: string;
  description: string;
  soulMd: string;
  model: string;
  colorIdx: number;
  ragFiles: File[];
  mcpIds: string[];
  skillIds: string[];
  wecomEnabled: boolean;
  wecomConfig: WecomConfig;
}

const INITIAL_DATA: WizardData = {
  name: "", description: "", soulMd: "",
  model: "anthropic/claude-sonnet-4-6", colorIdx: 0,
  ragFiles: [], mcpIds: [], skillIds: [],
  wecomEnabled: false,
  wecomConfig: { corpId: "", corpSecret: "", agentId: "", token: "", encodingAESKey: "" },
};

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-0 px-6 py-4">
      {STEP_LABELS.map((label, i) => {
        const num = i + 1;
        const done = num < step;
        const active = num === step;
        return (
          <div key={num} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  done   && "bg-emerald-500 text-white",
                  active && "bg-blue-500 text-white ring-2 ring-blue-500/30",
                  !done && !active && "bg-gray-800 text-gray-500",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : num}
              </div>
              <span className={cn("text-[10px] whitespace-nowrap", active ? "text-gray-200" : "text-gray-600")}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={cn("mb-4 h-px w-10 transition-colors", done ? "bg-emerald-500/50" : "bg-gray-800")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Selection card (MCP / Skills) ─────────────────────────────────────────────

function SelectCard({
  id, title, subtitle, selected, onToggle,
}: { id: string; title: string; subtitle?: string | null; selected: boolean; onToggle: (id: string) => void }) {
  return (
    <div
      onClick={() => onToggle(id)}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
        selected
          ? "border-blue-500/60 bg-blue-500/10"
          : "border-gray-700 hover:border-gray-600 hover:bg-gray-800/50",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors",
          selected ? "border-blue-500 bg-blue-500" : "border-gray-600",
        )}
      >
        {selected && <Check className="h-3 w-3 text-white" />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-100">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Steps ─────────────────────────────────────────────────────────────────────

function Step1Basic({ data, onChange }: { data: WizardData; onChange: (p: Partial<WizardData>) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-gray-300">名称 <span className="text-red-400">*</span></Label>
        <Input
          value={data.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="例：客服助手"
          className="border-gray-700 bg-gray-800 text-gray-50 placeholder:text-gray-600"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-gray-300">描述</Label>
        <Input
          value={data.description}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="简短描述这个 Agent 的用途"
          className="border-gray-700 bg-gray-800 text-gray-50 placeholder:text-gray-600"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-gray-300">SOUL.md <span className="text-gray-500 font-normal text-xs">（角色设定与人格）</span></Label>
        <Textarea
          value={data.soulMd}
          onChange={e => onChange({ soulMd: e.target.value })}
          placeholder={"# 角色\n你是一个专业的客服助手...\n\n# 原则\n- 保持友善\n- 简明扼要"}
          rows={6}
          className="border-gray-700 bg-gray-800 font-mono text-sm text-gray-50 placeholder:text-gray-600"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-gray-300">模型</Label>
        <select
          value={data.model}
          onChange={e => onChange({ model: e.target.value })}
          className="flex h-10 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-50 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {MODELS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-gray-300">颜色主题</Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map(c => (
            <button
              key={c.idx}
              type="button"
              onClick={() => onChange({ colorIdx: c.idx })}
              title={c.label}
              className={cn(
                "h-7 w-7 rounded-full transition-all",
                c.bg,
                data.colorIdx === c.idx && `ring-2 ring-offset-2 ring-offset-gray-800 ${c.ring}`,
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Step2Rag({ data, onChange }: { data: WizardData; onChange: (p: Partial<WizardData>) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = (files: File[]) => {
    const allowed = files.filter(f => /\.(txt|md|pdf|docx)$/i.test(f.name));
    onChange({ ragFiles: [...data.ragFiles, ...allowed] });
  };

  const removeFile = (idx: number) => {
    onChange({ ragFiles: data.ragFiles.filter((_, i) => i !== idx) });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        上传文档构建知识库，支持 <span className="font-mono text-gray-300">.txt .md .pdf .docx</span>（最大 50 MB）
      </p>

      {/* Dropzone */}
      <div
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 transition-colors",
          dragging ? "border-blue-500 bg-blue-500/5" : "border-gray-700 hover:border-gray-600 hover:bg-gray-800/30",
        )}
      >
        <Upload className="mb-3 h-8 w-8 text-gray-600" />
        <p className="text-sm font-medium text-gray-400">拖拽文件到此处，或点击选择</p>
        <p className="mt-1 text-xs text-gray-600">支持批量上传</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.pdf,.docx"
          className="hidden"
          onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
        />
      </div>

      {/* File list */}
      {data.ragFiles.length > 0 && (
        <div className="space-y-2">
          {data.ragFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5">
              <FileText className="h-4 w-4 flex-shrink-0 text-gray-500" />
              <span className="flex-1 truncate text-sm text-gray-200">{f.name}</span>
              <span className="flex-shrink-0 text-xs text-gray-500">{formatSize(f.size)}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="ml-1 rounded p-0.5 text-gray-600 hover:text-gray-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {data.ragFiles.length === 0 && (
        <p className="text-center text-xs text-gray-600">也可跳过，创建后再上传</p>
      )}
    </div>
  );
}

function Step3Mcp({
  data, onChange, servers, loading,
}: {
  data: WizardData;
  onChange: (p: Partial<WizardData>) => void;
  servers: McpServer[];
  loading: boolean;
}) {
  const toggle = (id: string) => {
    onChange({
      mcpIds: data.mcpIds.includes(id)
        ? data.mcpIds.filter(x => x !== id)
        : [...data.mcpIds, id],
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-gray-500">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载 MCP 工具注册表…
    </div>
  );

  if (servers.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-gray-500">暂无可用的 MCP 服务器</p>
      <p className="mt-1 text-xs text-gray-600">管理员可在后台注册 MCP 服务器</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">
        已选 <span className="font-semibold text-gray-200">{data.mcpIds.length}</span> 个 MCP 工具
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {servers.map(s => (
          <SelectCard
            key={s.id}
            id={s.id}
            title={s.name}
            subtitle={s.description ?? s.endpoint}
            selected={data.mcpIds.includes(s.id)}
            onToggle={toggle}
          />
        ))}
      </div>
    </div>
  );
}

function Step4Skills({
  data, onChange, skills, loading,
}: {
  data: WizardData;
  onChange: (p: Partial<WizardData>) => void;
  skills: Skill[];
  loading: boolean;
}) {
  const toggle = (id: string) => {
    onChange({
      skillIds: data.skillIds.includes(id)
        ? data.skillIds.filter(x => x !== id)
        : [...data.skillIds, id],
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-gray-500">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载技能中心…
    </div>
  );

  if (skills.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-gray-500">暂无可用技能</p>
      <p className="mt-1 text-xs text-gray-600">管理员可在后台注册技能</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">
        已选 <span className="font-semibold text-gray-200">{data.skillIds.length}</span> 个技能
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {skills.map(s => (
          <SelectCard
            key={s.id}
            id={s.id}
            title={`${s.icon ? s.icon + " " : ""}${s.name}`}
            subtitle={s.description}
            selected={data.skillIds.includes(s.id)}
            onToggle={toggle}
          />
        ))}
      </div>
    </div>
  );
}

function Step5Channels({ data, onChange }: { data: WizardData; onChange: (p: Partial<WizardData>) => void }) {
  const setWecom = (patch: Partial<WecomConfig>) =>
    onChange({ wecomConfig: { ...data.wecomConfig, ...patch } });

  return (
    <div className="space-y-5">
      {/* Web Chat – always enabled */}
      <div className="flex items-center justify-between rounded-lg border border-gray-700 p-4">
        <div>
          <p className="font-medium text-gray-100">Web Chat</p>
          <p className="text-xs text-gray-500">网页端聊天界面，自动开启</p>
        </div>
        <div className="flex h-5 w-9 items-center rounded-full bg-blue-500">
          <div className="ml-auto mr-0.5 h-4 w-4 rounded-full bg-white shadow" />
        </div>
      </div>

      {/* WeChat Work */}
      <div className="rounded-lg border border-gray-700">
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="font-medium text-gray-100">企业微信</p>
            <p className="text-xs text-gray-500">通过企业微信应用接收消息并回复</p>
          </div>
          <button
            type="button"
            onClick={() => onChange({ wecomEnabled: !data.wecomEnabled })}
            className={cn(
              "relative flex h-5 w-9 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors",
              data.wecomEnabled ? "bg-blue-500" : "bg-gray-700",
            )}
          >
            <div
              className={cn(
                "h-4 w-4 rounded-full bg-white shadow transition-transform",
                data.wecomEnabled ? "translate-x-4" : "translate-x-0.5",
              )}
            />
          </button>
        </div>

        {data.wecomEnabled && (
          <div className="grid gap-3 border-t border-gray-700 p-4 sm:grid-cols-2">
            {[
              { key: "corpId",         label: "Corp ID",           placeholder: "wx..." },
              { key: "corpSecret",     label: "Corp Secret",       placeholder: "企业应用 Secret" },
              { key: "agentId",        label: "AgentId",           placeholder: "1000001" },
              { key: "token",          label: "Token",             placeholder: "验证 Token" },
              { key: "encodingAESKey", label: "EncodingAESKey",    placeholder: "43 位 Base64 密钥" },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs text-gray-400">{label}</Label>
                <Input
                  value={data.wecomConfig[key as keyof WecomConfig]}
                  onChange={e => setWecom({ [key]: e.target.value })}
                  placeholder={placeholder}
                  className="border-gray-700 bg-gray-800 text-sm text-gray-50 placeholder:text-gray-600"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export default function CreateAgentWizard({
  onCreated,
  trigger,
}: {
  onCreated: () => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [error, setError] = useState("");

  // Fetch registries when wizard opens
  useEffect(() => {
    if (!open) return;
    setRegistryLoading(true);
    Promise.all([
      fetch("/api/proxy/api/mcp/servers").then(r => r.json()).catch(() => ({})),
      fetch("/api/proxy/api/skills").then(r => r.json()).catch(() => ({})),
    ]).then(([mcp, sk]) => {
      setMcpServers((mcp as { data?: { servers: McpServer[] } }).data?.servers ?? []);
      setSkills((sk as { data?: { skills: Skill[] } }).data?.skills ?? []);
    }).finally(() => setRegistryLoading(false));
  }, [open]);

  const patch = useCallback((p: Partial<WizardData>) => setData(prev => ({ ...prev, ...p })), []);

  const openWizard = () => {
    setStep(1);
    setData(INITIAL_DATA);
    setError("");
    setOpen(true);
  };

  const handleNext = () => {
    if (step === 1 && !data.name.trim()) { setError("请填写 Agent 名称"); return; }
    setError("");
    setStep(s => s + 1);
  };

  const handleBack = () => { setError(""); setStep(s => s - 1); };

  const handleComplete = async () => {
    setSubmitting(true);
    setError("");
    try {
      // 1 — Create agent
      setSubmitMsg("正在创建 Agent…");
      const r1 = await fetch("/api/proxy/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          description: data.description || undefined,
          soulMd: data.soulMd || undefined,
          model: data.model,
          colorIdx: data.colorIdx,
        }),
      });
      const j1 = await r1.json() as { success: boolean; data?: { agent: { id: string } }; error?: string };
      if (!j1.success) throw new Error(j1.error ?? "创建 Agent 失败");
      const agentId = j1.data!.agent.id;

      // 2 — Upload RAG files
      if (data.ragFiles.length > 0) {
        setSubmitMsg(`上传知识库文件 (${data.ragFiles.length} 个)…`);
        await Promise.all(data.ragFiles.map(file => {
          const fd = new FormData();
          fd.append("file", file);
          return fetch(`/api/proxy/api/rag/${agentId}/documents`, { method: "POST", body: fd });
        }));
      }

      // 3 — Bind MCP servers
      if (data.mcpIds.length > 0) {
        setSubmitMsg("绑定 MCP 工具…");
        await Promise.all(data.mcpIds.map(mcpServerId =>
          fetch(`/api/proxy/api/agents/${agentId}/mcp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mcpServerId }),
          }),
        ));
      }

      // 4 — Bind skills
      if (data.skillIds.length > 0) {
        setSubmitMsg("绑定技能…");
        await Promise.all(data.skillIds.map(skillId =>
          fetch(`/api/proxy/api/agents/${agentId}/skills`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ skillId }),
          }),
        ));
      }

      // 5 — Configure WeChat Work
      if (data.wecomEnabled) {
        setSubmitMsg("配置企业微信渠道…");
        await fetch(`/api/proxy/api/agents/${agentId}/channels/WECOM`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelConfig: data.wecomConfig, enabled: true }),
        });
      }

      setOpen(false);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败，请重试");
    } finally {
      setSubmitting(false);
      setSubmitMsg("");
    }
  };

  const isLastStep = step === STEP_LABELS.length;

  return (
    <>
      {trigger ? (
        <div onClick={openWizard} className="cursor-pointer">
          {trigger}
        </div>
      ) : (
        <Button onClick={openWizard} className="gap-2 bg-blue-600 text-white hover:bg-blue-500">
          <Plus className="h-4 w-4" />
          新建 Agent
        </Button>
      )}

      <Dialog open={open} onOpenChange={o => { if (!submitting) setOpen(o); }}>
        <DialogContent className="flex max-h-[92vh] flex-col p-0">
          <DialogHeader className="border-b border-gray-800">
            <DialogTitle className="sr-only">新建 Agent</DialogTitle>
            <StepIndicator step={step} />
          </DialogHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {step === 1 && <Step1Basic data={data} onChange={patch} />}
            {step === 2 && <Step2Rag data={data} onChange={patch} />}
            {step === 3 && <Step3Mcp data={data} onChange={patch} servers={mcpServers} loading={registryLoading} />}
            {step === 4 && <Step4Skills data={data} onChange={patch} skills={skills} loading={registryLoading} />}
            {step === 5 && <Step5Channels data={data} onChange={patch} />}
          </div>

          {/* Footer */}
          <DialogFooter>
            <div className="flex items-center gap-2">
              {step > 1 && !submitting && (
                <Button variant="ghost" onClick={handleBack} className="text-gray-400 hover:text-gray-200">
                  <ChevronLeft className="mr-1 h-4 w-4" /> 上一步
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {error && <p className="max-w-xs text-xs text-red-400">{error}</p>}
              {submitMsg && (
                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {submitMsg}
                </span>
              )}
              {isLastStep ? (
                <Button
                  onClick={handleComplete}
                  disabled={submitting}
                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  完成创建
                </Button>
              ) : (
                <Button onClick={handleNext} className="bg-blue-600 text-white hover:bg-blue-500">
                  下一步 <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
