/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Toaster } from "sonner"
import { Layout } from "./components/layout"
import { ProtectedRoute } from "./components/protected-route"
import { Login } from "./pages/login"
import { Dashboard } from "./pages/dashboard"
import { Models } from "./pages/models"
import { Agents } from "./pages/agents"
import { AgentDetail } from "./pages/agent-detail"
import { Settings } from "./pages/settings"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="models" element={<Models />} />
            <Route path="agents" element={<Agents />} />
            <Route path="agents/:id" element={<AgentDetail />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>
      </Routes>
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  )
}
