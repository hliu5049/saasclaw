"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Channel {
  id: string;
  channelType: "WEBCHAT" | "WECOM" | "DINGTALK" | "FEISHU";
  channelConfig: Record<string, string>;
  enabled: boolean;
}

interface WecomForm {
  corpId: string;
  corpSecret: string;
  agentId: string;
  token: string;
  encodingAESKey: string;
}

const WECOM_FIELDS: { key: keyof WecomForm; label: string; placeholder: string; type?: string }[] = [
  { key: "corpId",         label: "Corp ID",          placeholder: "wx..." },
  { key: "corpSecret",     label: "Corp Secret",       placeholder: "企业应用 Secret", type: "password" },
  { key: "agentId",        label: "AgentId",           placeholder: "1000001" },
  { key: "token",          label: "Token",             placeholder: "验证 Token" },
  { key: "encodingAESKey", label: "EncodingAESKey",    placeholder: "43 位 Base64 密钥" },
];

const EMPTY_WECOM: WecomForm = { corpId: "", corpSecret: "", agentId: "", token: "", encodingAESKey: "" };

export default function ChannelsTab({ agentId }: { agentId: string }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [wecomEnabled, setWecomEnabled] = useState(false);
  const [wecomForm, setWecomForm] = useState<WecomForm>(EMPTY_WECOM);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/proxy/api/agents/${agentId}/channels`);
      const data = await res.json() as { success: boolean; data?: { channels: Channel[] } };
      const list = data.data?.channels ?? [];
      setChannels(list);

      const wecom = list.find(c => c.channelType === "WECOM");
      if (wecom) {
        setWecomEnabled(wecom.enabled);
        const cfg = (wecom.channelConfig ?? {}) as Partial<WecomForm>;
        setWecomForm({
          corpId:         cfg.corpId         ?? "",
          corpSecret:     cfg.corpSecret     ?? "",
          agentId:        cfg.agentId        ?? "",
          token:          cfg.token          ?? "",
          encodingAESKey: cfg.encodingAESKey ?? "",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchChannels(); }, [agentId]);

  const toggleWecom = async (enabled: boolean) => {
    setWecomEnabled(enabled);
    await fetch(`/api/proxy/api/agents/${agentId}/channels/WECOM`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, channelConfig: wecomForm }),
    });
  };

  const saveWecom = async () => {
    setSaving(true);
    try {
      await fetch(`/api/proxy/api/agents/${agentId}/channels/WECOM`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: wecomEnabled, channelConfig: wecomForm }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const webchatEnabled = channels.some(c => c.channelType === "WEBCHAT" && c.enabled) || channels.length === 0;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => <div key={i} className="h-20 animate-pulse rounded-xl border border-gray-800 bg-gray-900" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Web Chat */}
      <ChannelCard
        title="Web Chat"
        description="网页端聊天界面，已内置于平台"
        enabled={true}
        disabledToggle
      >
        <div className="mt-3 rounded-lg bg-gray-800/60 px-3 py-2">
          <p className="text-xs text-gray-500">Webhook URL</p>
          <p className="mt-0.5 break-all font-mono text-xs text-gray-300">
            {typeof window !== "undefined"
              ? `${window.location.origin}/dashboard/agents/${agentId}/chat`
              : `/dashboard/agents/${agentId}/chat`}
          </p>
        </div>
      </ChannelCard>

      {/* WeChat Work */}
      <ChannelCard
        title="企业微信"
        description="通过企业微信应用接收并回复消息"
        enabled={wecomEnabled}
        onToggle={toggleWecom}
      >
        {wecomEnabled && (
          <div className="mt-4 space-y-3 border-t border-gray-800 pt-4">
            {/* Webhook hint */}
            <div className="rounded-lg bg-gray-800/60 px-3 py-2">
              <p className="text-xs text-gray-500">企业微信回调 URL（在企微后台填写）</p>
              <p className="mt-0.5 break-all font-mono text-xs text-gray-300">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/api/proxy/api/channels/webhook/wecom/${agentId}`
                  : `/api/channels/webhook/wecom/${agentId}`}
              </p>
            </div>

            {/* Config fields */}
            <div className="grid gap-3 sm:grid-cols-2">
              {WECOM_FIELDS.map(({ key, label, placeholder, type }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs text-gray-400">{label}</Label>
                  <Input
                    type={type ?? "text"}
                    value={wecomForm[key]}
                    onChange={e => setWecomForm(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="border-gray-700 bg-gray-800 text-sm text-gray-50 placeholder:text-gray-600"
                  />
                </div>
              ))}
            </div>

            <Button
              onClick={saveWecom}
              disabled={saving}
              className={cn(
                "gap-2",
                saved
                  ? "bg-emerald-600 hover:bg-emerald-600"
                  : "bg-blue-600 hover:bg-blue-500",
              )}
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> 保存中…</>
              ) : saved ? (
                <><Check className="h-4 w-4" /> 已保存</>
              ) : (
                <><Save className="h-4 w-4" /> 保存配置</>
              )}
            </Button>
          </div>
        )}
      </ChannelCard>

      {/* DingTalk / Feishu – placeholders */}
      {(["DINGTALK", "FEISHU"] as const).map(type => (
        <ChannelCard
          key={type}
          title={type === "DINGTALK" ? "钉钉" : "飞书"}
          description="即将支持"
          enabled={false}
          disabledToggle
        />
      ))}
    </div>
  );
}

function Toggle({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!enabled)}
      className={cn(
        "relative flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors",
        enabled ? "bg-blue-500" : "bg-gray-700",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <div
        className={cn(
          "h-4 w-4 rounded-full bg-white shadow transition-transform",
          enabled ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function ChannelCard({
  title,
  description,
  enabled,
  onToggle,
  disabledToggle,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle?: (v: boolean) => void;
  disabledToggle?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-100">{title}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        <Toggle enabled={enabled} onChange={onToggle} disabled={disabledToggle} />
      </div>
      {children}
    </div>
  );
}
