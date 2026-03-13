/**
 * API Client for backend communication
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001"

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message)
    this.name = "ApiError"
  }
}

class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
    // Load token from localStorage
    this.token = localStorage.getItem("auth_token")
  }

  setToken(token: string | null) {
    this.token = token
    if (token) {
      localStorage.setItem("auth_token", token)
    } else {
      localStorage.removeItem("auth_token")
    }
  }

  getToken() {
    return this.token
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    }

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    })

    const data = await response.json()

    if (!response.ok) {
      throw new ApiError(
        data.error || "Request failed",
        response.status,
        data
      )
    }

    return data
  }

  // Auth endpoints
  async sendOtp(email: string) {
    return this.request<{ success: boolean; data: { message: string } }>(
      "/api/auth/send-otp",
      {
        method: "POST",
        body: JSON.stringify({ email }),
      }
    )
  }

  async verifyOtp(email: string, code: string) {
    return this.request<{ success: boolean; data: { token: string; user: any } }>(
      "/api/auth/verify-otp",
      {
        method: "POST",
        body: JSON.stringify({ email, code }),
      }
    )
  }

  async login(email: string, password: string) {
    return this.request<{ success: boolean; data: { token: string; user: any } }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    )
  }

  async googleLogin(credential: string) {
    return this.request<{ success: boolean; data: { token: string; user: any } }>(
      "/api/auth/google",
      {
        method: "POST",
        body: JSON.stringify({ credential }),
      }
    )
  }

  async getMe() {
    return this.request<{ success: boolean; data: { user: any } }>(
      "/api/auth/me"
    )
  }

  // Models endpoints
  async getModels() {
    return this.request<any[]>("/api/llm-providers")
  }

  async createModel(model: any) {
    return this.request<any>("/api/llm-providers", {
      method: "POST",
      body: JSON.stringify(model),
    })
  }

  async updateModel(id: string, model: any) {
    return this.request<any>(`/api/llm-providers/${id}`, {
      method: "PUT",
      body: JSON.stringify(model),
    })
  }

  async deleteModel(id: string) {
    return this.request<{ success: true }>(`/api/llm-providers/${id}`, {
      method: "DELETE",
    })
  }

  async testModel(id: string) {
    return this.request<{ success: true; message: string }>(
      `/api/llm-providers/${id}/test`,
      {
        method: "POST",
      }
    )
  }

  // Agents endpoints
  async getAgents() {
    return this.request<{ success: boolean; data: { agents: any[] } }>(
      "/api/agents"
    )
  }

  async createAgent(agent: any) {
    return this.request<{ success: boolean; data: { agent: any } }>(
      "/api/agents",
      {
        method: "POST",
        body: JSON.stringify(agent),
      }
    )
  }

  async updateAgent(id: string, agent: any) {
    return this.request(`/api/agents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(agent),
    })
  }

  async deleteAgent(id: string) {
    return this.request(`/api/agents/${id}`, {
      method: "DELETE",
    })
  }

  async getAgent(id: string) {
    return this.request<{ success: boolean; data: { agent: any } }>(
      `/api/agents/${id}`
    )
  }
}

export const api = new ApiClient(API_BASE_URL)
