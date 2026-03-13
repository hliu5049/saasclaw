import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-zinc-500">Manage your account settings and preferences.</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Preferences</CardTitle>
              <CardDescription>
                Customize how the AI Agent Manager behaves.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="auto-start" className="flex flex-col space-y-1">
                  <span>Auto-start Agents</span>
                  <span className="font-normal text-sm text-zinc-500">
                    Automatically start agents when the system boots.
                  </span>
                </Label>
                <Switch id="auto-start" defaultChecked />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="notifications" className="flex flex-col space-y-1">
                  <span>Email Notifications</span>
                  <span className="font-normal text-sm text-zinc-500">
                    Receive emails when tasks fail or complete.
                  </span>
                </Label>
                <Switch id="notifications" />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="dark-mode" className="flex flex-col space-y-1">
                  <span>Dark Mode</span>
                  <span className="font-normal text-sm text-zinc-500">
                    Enable dark mode for the dashboard.
                  </span>
                </Label>
                <Switch id="dark-mode" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="api-keys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Provider API Keys</CardTitle>
              <CardDescription>
                Configure your API keys for different AI providers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="openai">OpenAI API Key</Label>
                <Input id="openai" type="password" defaultValue="sk-..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anthropic">Anthropic API Key</Label>
                <Input id="anthropic" type="password" defaultValue="sk-ant-..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="google">Google Gemini API Key</Label>
                <Input id="google" type="password" defaultValue="AIza..." />
              </div>
              <Button>Save Keys</Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Configure advanced system parameters.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="max-concurrent">Max Concurrent Tasks</Label>
                <Input id="max-concurrent" type="number" defaultValue="10" />
                <p className="text-sm text-zinc-500">
                  Maximum number of tasks that can run simultaneously across all agents.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeout">Default Task Timeout (seconds)</Label>
                <Input id="timeout" type="number" defaultValue="300" />
              </div>
              <Button>Save Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
