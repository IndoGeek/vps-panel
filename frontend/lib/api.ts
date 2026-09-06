export type HealthResponse = {
  status: string;
};

export type SystemInfo = {
  hostname: string;
  os: string;
  architecture: string;
  kernel: string;
};

export type SystemMetrics = {
  cpu_percent: number;

  memory_percent: number;
  memory_used_bytes: number;
  memory_total_bytes: number;

  swap_percent: number;
  swap_used_bytes: number;
  swap_total_bytes: number;

  disk_percent: number;
  disk_used_bytes: number;
  disk_total_bytes: number;

  load_1: number;
  load_5: number;
  load_15: number;

  uptime_seconds: number;

  network_rx_bytes: number;
  network_tx_bytes: number;
};

export type UserInfo = {
  username: string;
  uid: number;
  gid: number;
  home_dir: string;
  shell: string;
};

export type SessionInfo = {
  name: string;
  windows: number;
  attached: boolean;
};

export type ProcessInfo = {
  pid: number;
  ppid: number;
  uid: number;
  state: string;
  command: string;
};

export type ServiceInfo = {
  name: string;
  description: string;
  active: boolean;
  enabled: boolean;
};

export type Snapshot = {
  System: SystemInfo;
  Metrics: SystemMetrics;
  Users: UserInfo[];
  Sessions: SessionInfo[];
  Processes: ProcessInfo[];
  Services: ServiceInfo[];
};

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch("/api/health");

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }

  return response.json();
}

export async function getSnapshot(): Promise<Snapshot> {
  const baseUrl =
    typeof window === "undefined" ? (process.env.BACKEND_API_URL ?? "http://127.0.0.1:8090") : "";

  const response = await fetch(`${baseUrl}/api/v1/snapshot`);

  if (!response.ok) {
    throw new Error(`Snapshot request failed: ${response.status}`);
  }

  return response.json();
}

export type MeResponse = {
  authenticated: boolean;
  user: UserInfo;
};

export async function getMe(): Promise<MeResponse> {
  const response = await fetch("/api/v1/me", {
    credentials: "include",
  });

  if (response.status === 401) {
    return {
      authenticated: false,
      user: {} as UserInfo,
    };
  }

  if (!response.ok) {
    throw new Error(`Authentication check failed: ${response.status}`);
  }

  return response.json();
}

export async function logout(): Promise<void> {
  const response = await fetch("/api/v1/auth/logout", {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Logout failed: ${response.status}`);
  }
}

export type AuditEntry = {
  id: number;
  created_at: string;
  username: string;
  action: string;
  resource_type: string;
  resource_name: string;
  status: string;
  ip_address: string;
  user_agent: string;
  details: string;
};

export type AuditResponse = {
  entries: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
};

export async function getAuditLogs({
  limit = 50,
  offset = 0,
  action = "",
  status = "",
}: {
  limit?: number;
  offset?: number;
  action?: string;
  status?: string;
} = {}): Promise<AuditResponse> {
  const params = new URLSearchParams();

  params.set("limit", String(limit));

  params.set("offset", String(offset));

  if (action) {
    params.set("action", action);
  }

  if (status) {
    params.set("status", status);
  }

  const response = await fetch(`/api/v1/audit?${params.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 401) {
    throw new Error("UNAUTHORIZED");
  }

  if (!response.ok) {
    throw new Error(`Audit request failed: ${response.status}`);
  }

  return response.json();
}
