export type HealthResponse = {
  status: string;
};

export type SystemInfo = {
  hostname: string;
  os: string;
  architecture: string;
  kernel: string;
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
