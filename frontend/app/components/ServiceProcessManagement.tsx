"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  getProcesses,
  getServices,
  killProcess,
  manageService,
  type ProcessInfo,
  type ProcessKillSignal,
  type ServiceAction,
  type ServiceInfo,
} from "@/lib/api";

type ManagementMode = "services" | "processes";

type ServiceFilter = "all" | "running" | "stopped" | "enabled" | "disabled";

type ProcessSort = "cpu" | "memory" | "pid" | "name";

function formatBytes(bytes = 0) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];

  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  if (index === 0) {
    return `${Math.round(value)} ${units[index]}`;
  }

  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`;
}

function formatPercent(value = 0) {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function stateLabel(state: string) {
  const first = state.trim().charAt(0);

  switch (first) {
    case "R":
      return "Running";

    case "S":
      return "Sleeping";

    case "D":
      return "Waiting";

    case "T":
      return "Stopped";

    case "Z":
      return "Zombie";

    default:
      return state || "Unknown";
  }
}

function ServiceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="4" y="4" width="16" height="6" rx="1.5" />

      <rect x="4" y="14" width="16" height="6" rx="1.5" />

      <path d="M8 7h.01M8 17h.01M12 7h5M12 17h5" />
    </svg>
  );
}

function ProcessIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />

      <path d="M8 9h8M8 12h5M8 15h8" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 11a8 8 0 0 0-14.9-4" />
      <path d="M4 4v5h5" />
      <path d="M4 13a8 8 0 0 0 14.9 4" />
      <path d="M20 20v-5h-5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />

      <path d="m20 20-4-4" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="m8 5 11 7-11 7V5Z" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 11a8 8 0 0 0-14.9-4" />
      <path d="M4 4v5h5" />
    </svg>
  );
}

function KillIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M6 6 18 18M18 6 6 18" />
    </svg>
  );
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "blue" | "red";
}) {
  const classes = {
    neutral: "bg-zinc-800 text-zinc-400",
    green: "bg-green-400/10 text-green-400",
    blue: "bg-blue-400/10 text-blue-400",
    red: "bg-red-400/10 text-red-400",
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] ${classes[tone]}`}>{children}</span>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  danger = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-3 py-2 text-xs font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? "bg-red-400/10 text-red-300 hover:bg-red-400/20"
          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
      }`}
      style={{
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}
    >
      {children}
    </button>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  danger = false,
  loading = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[22000] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <h3 className="text-lg font-semibold">{title}</h3>

        <p className="mt-3 text-sm leading-6 text-zinc-500">{description}</p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-full bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50 ${
              danger
                ? "bg-red-500 text-white hover:bg-red-400"
                : "bg-zinc-100 text-zinc-950 hover:bg-white"
            }`}
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ServiceActionButtons({
  service,
  busy,
  onAction,
  onConfirm,
}: {
  service: ServiceInfo;
  busy: boolean;
  onAction: (action: ServiceAction) => void;
  onConfirm: (action: ServiceAction) => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {!service.active && (
        <ActionButton disabled={busy} onClick={() => onAction("start")}>
          <span className="inline-flex items-center gap-1.5">
            <PlayIcon />
            Start
          </span>
        </ActionButton>
      )}

      {service.active && (
        <ActionButton disabled={busy} danger onClick={() => onConfirm("stop")}>
          <span className="inline-flex items-center gap-1.5">
            <StopIcon />
            Stop
          </span>
        </ActionButton>
      )}

      <ActionButton disabled={busy} onClick={() => onConfirm("restart")}>
        <span className="inline-flex items-center gap-1.5">
          <RestartIcon />
          Restart
        </span>
      </ActionButton>

      {service.enabled ? (
        <ActionButton disabled={busy} onClick={() => onConfirm("disable")}>
          Disable
        </ActionButton>
      ) : (
        <ActionButton disabled={busy} onClick={() => onAction("enable")}>
          Enable
        </ActionButton>
      )}
    </div>
  );
}

export default function ServiceProcessManagement({ mode }: { mode: ManagementMode }) {
  const [services, setServices] = useState<ServiceInfo[]>([]);

  const [processes, setProcesses] = useState<ProcessInfo[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("all");

  const [processSort, setProcessSort] = useState<ProcessSort>("cpu");

  const [serviceConfirmation, setServiceConfirmation] = useState<{
    service: ServiceInfo;
    action: ServiceAction;
  } | null>(null);

  const [killTarget, setKillTarget] = useState<ProcessInfo | null>(null);

  const [busyKey, setBusyKey] = useState("");

  const [statusMessage, setStatusMessage] = useState("");

  const load = async (showSpinner = true) => {
    try {
      if (showSpinner) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      if (mode === "services") {
        const result = await getServices();

        setServices(result);
      } else {
        const result = await getProcesses();

        setProcesses(result);
      }
    } catch (loadError) {
      if (loadError instanceof Error && loadError.message === "UNAUTHORIZED") {
        window.location.reload();
        return;
      }

      console.error("Management load failed:", loadError);

      setError(loadError instanceof Error ? loadError.message : "Unable to load management data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setSearch("");
    setError("");
    setStatusMessage("");

    void load();

    const interval = window.setInterval(
      () => {
        void load(false);
      },
      mode === "processes" ? 5000 : 10000,
    );

    return () => window.clearInterval(interval);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return services.filter((service) => {
      const matchesSearch =
        !query ||
        service.name.toLowerCase().includes(query) ||
        service.description.toLowerCase().includes(query);

      if (!matchesSearch) {
        return false;
      }

      switch (serviceFilter) {
        case "running":
          return service.active;

        case "stopped":
          return !service.active;

        case "enabled":
          return service.enabled;

        case "disabled":
          return !service.enabled;

        default:
          return true;
      }
    });
  }, [services, search, serviceFilter]);

  const filteredProcesses = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = processes.filter((process) => {
      if (!query) {
        return true;
      }

      return (
        String(process.pid).includes(query) ||
        (process.user ?? "").toLowerCase().includes(query) ||
        process.command.toLowerCase().includes(query)
      );
    });

    return [...result].sort((a, b) => {
      switch (processSort) {
        case "memory":
          return (b.memory_percent ?? 0) - (a.memory_percent ?? 0);

        case "pid":
          return a.pid - b.pid;

        case "name":
          return a.command.localeCompare(b.command);

        default:
          return (b.cpu_percent ?? 0) - (a.cpu_percent ?? 0);
      }
    });
  }, [processes, search, processSort]);

  const runServiceAction = async (service: ServiceInfo, action: ServiceAction) => {
    const key = `${service.name}:${action}`;

    try {
      setBusyKey(key);
      setError("");
      setStatusMessage("");

      await manageService(service.name, action);

      setStatusMessage(`${service.name}: ${action} completed.`);

      await load(false);
    } catch (actionError) {
      if (actionError instanceof Error && actionError.message === "UNAUTHORIZED") {
        window.location.reload();
        return;
      }

      setError(actionError instanceof Error ? actionError.message : `Unable to ${action} service.`);
    } finally {
      setBusyKey("");
    }
  };

  const runProcessKill = async (process: ProcessInfo, signal: ProcessKillSignal) => {
    const key = `${process.pid}:${signal}`;

    try {
      setBusyKey(key);
      setError("");
      setStatusMessage("");

      await killProcess(process.pid, signal);

      setKillTarget(null);

      setStatusMessage(`PID ${process.pid} received ${signal === "KILL" ? "SIGKILL" : "SIGTERM"}.`);

      await load(false);
    } catch (actionError) {
      if (actionError instanceof Error && actionError.message === "UNAUTHORIZED") {
        window.location.reload();
        return;
      }

      setError(actionError instanceof Error ? actionError.message : "Unable to terminate process.");
    } finally {
      setBusyKey("");
    }
  };

  const runningCount = services.filter((service) => service.active).length;

  const enabledCount = services.filter((service) => service.enabled).length;

  if (mode === "services") {
    return (
      <>
        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
                  <ServiceIcon />
                </div>

                <div>
                  <h2 className="text-lg font-semibold">Services</h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    {runningCount} running · {enabledCount} enabled · {services.length} total
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={refreshing}
                onClick={() => void load(false)}
                className="flex w-fit items-center gap-2 rounded-full bg-zinc-800 px-4 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
              >
                <RefreshIcon />

                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-3 lg:flex-row">
              <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4">
                <SearchIcon />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search services…"
                  className="w-full bg-transparent py-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["all", "All"],
                    ["running", "Running"],
                    ["stopped", "Stopped"],
                    ["enabled", "Enabled"],
                    ["disabled", "Disabled"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setServiceFilter(value)}
                    className={`rounded-full px-4 py-2.5 text-xs font-medium transition ${
                      serviceFilter === value
                        ? "bg-zinc-100 text-zinc-950"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="border-b border-zinc-800 bg-red-400/5 p-5 text-sm text-red-300">
              {error}
            </div>
          )}

          {statusMessage && (
            <div className="border-b border-zinc-800 bg-green-400/5 p-5 text-sm text-green-300">
              {statusMessage}
            </div>
          )}

          {loading ? (
            <div className="p-10 text-center text-sm text-zinc-500">Loading services…</div>
          ) : filteredServices.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-zinc-400">No services found.</p>

              <p className="mt-2 text-xs text-zinc-600">Try changing the filter or search term.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {filteredServices.map((service) => {
                const serviceBusy = busyKey.startsWith(`${service.name}:`);

                return (
                  <article key={service.name} className="p-5 transition hover:bg-zinc-800/30">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
                      <div className="flex min-w-0 flex-1 items-start gap-4">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                            service.active
                              ? "bg-green-400/10 text-green-400"
                              : "bg-zinc-800 text-zinc-500"
                          }`}
                        >
                          <ServiceIcon />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-zinc-200">{service.name}</p>

                            <Pill tone={service.active ? "green" : "neutral"}>
                              {service.active ? "Running" : "Stopped"}
                            </Pill>

                            <Pill tone={service.enabled ? "blue" : "neutral"}>
                              {service.enabled ? "Enabled" : "Disabled"}
                            </Pill>
                          </div>

                          <p className="mt-2 text-sm text-zinc-500">
                            {service.description || "System service"}
                          </p>
                        </div>
                      </div>

                      <ServiceActionButtons
                        service={service}
                        busy={serviceBusy}
                        onAction={(action) => void runServiceAction(service, action)}
                        onConfirm={(action) =>
                          setServiceConfirmation({
                            service,
                            action,
                          })
                        }
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {serviceConfirmation && (
          <ConfirmDialog
            title={`${serviceConfirmation.action === "restart" ? "Restart" : serviceConfirmation.action === "stop" ? "Stop" : "Disable"} ${serviceConfirmation.service.name}?`}
            description={
              serviceConfirmation.action === "restart"
                ? "The service will be restarted immediately. Applications depending on it may briefly become unavailable."
                : serviceConfirmation.action === "stop"
                  ? "The service will be stopped immediately. Applications depending on it may become unavailable."
                  : "The service will no longer be enabled to start automatically during boot."
            }
            confirmLabel={
              serviceConfirmation.action === "restart"
                ? "Restart service"
                : serviceConfirmation.action === "stop"
                  ? "Stop service"
                  : "Disable service"
            }
            danger={serviceConfirmation.action !== "restart"}
            loading={busyKey.startsWith(`${serviceConfirmation.service.name}:`)}
            onCancel={() => setServiceConfirmation(null)}
            onConfirm={() => {
              const confirmation = serviceConfirmation;

              setServiceConfirmation(null);

              void runServiceAction(confirmation.service, confirmation.action);
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
                <ProcessIcon />
              </div>

              <div>
                <h2 className="text-lg font-semibold">Processes</h2>

                <p className="mt-1 text-sm text-zinc-500">{processes.length} running processes</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={processSort}
                onChange={(event) => setProcessSort(event.target.value as ProcessSort)}
                className="rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-zinc-300 outline-none"
              >
                <option value="cpu">Sort: CPU</option>

                <option value="memory">Sort: Memory</option>

                <option value="pid">Sort: PID</option>

                <option value="name">Sort: Name</option>
              </select>

              <button
                type="button"
                disabled={refreshing}
                onClick={() => void load(false)}
                className="flex items-center gap-2 rounded-full bg-zinc-800 px-4 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
              >
                <RefreshIcon />

                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>

          <label className="mt-5 flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4">
            <SearchIcon />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search PID, user, or command…"
              className="w-full bg-transparent py-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
            />
          </label>
        </div>

        {error && (
          <div className="border-b border-zinc-800 bg-red-400/5 p-5 text-sm text-red-300">
            {error}
          </div>
        )}

        {statusMessage && (
          <div className="border-b border-zinc-800 bg-green-400/5 p-5 text-sm text-green-300">
            {statusMessage}
          </div>
        )}

        {loading ? (
          <div className="p-10 text-center text-sm text-zinc-500">Loading processes…</div>
        ) : filteredProcesses.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-zinc-400">No processes found.</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <div className="grid grid-cols-[90px_120px_90px_90px_1fr_120px] gap-4 border-b border-zinc-800 px-5 py-3 text-[11px] uppercase tracking-wide text-zinc-600">
                <span>PID</span>
                <span>User</span>
                <span>CPU</span>
                <span>Memory</span>
                <span>Command</span>
                <span className="text-right">Action</span>
              </div>

              <div className="divide-y divide-zinc-800">
                {filteredProcesses.map((process) => (
                  <div
                    key={process.pid}
                    className="grid grid-cols-[90px_120px_90px_90px_1fr_120px] items-center gap-4 px-5 py-4 transition hover:bg-zinc-800/30"
                  >
                    <span className="font-mono text-sm text-zinc-300">{process.pid}</span>

                    <span className="truncate text-sm text-zinc-400">
                      {process.user ?? `UID ${process.uid}`}
                    </span>

                    <span className="text-sm">{formatPercent(process.cpu_percent)}</span>

                    <span className="text-sm">{formatPercent(process.memory_percent)}</span>

                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-zinc-300">{process.command}</p>

                      <div className="mt-1 flex items-center gap-2">
                        <Pill>{stateLabel(process.state)}</Pill>

                        <span className="text-[11px] text-zinc-600">
                          {formatBytes(process.memory_bytes)}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <ActionButton
                        danger
                        disabled={busyKey.startsWith(`${process.pid}:`)}
                        onClick={() => setKillTarget(process)}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <KillIcon />
                          Kill
                        </span>
                      </ActionButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="divide-y divide-zinc-800 lg:hidden">
              {filteredProcesses.map((process) => (
                <article key={process.pid} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm text-zinc-200">{process.command}</p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Pill>PID {process.pid}</Pill>

                        <Pill>{process.user ?? `UID ${process.uid}`}</Pill>

                        <Pill tone={process.state.startsWith("R") ? "green" : "neutral"}>
                          {stateLabel(process.state)}
                        </Pill>
                      </div>
                    </div>

                    <ActionButton
                      danger
                      disabled={busyKey.startsWith(`${process.pid}:`)}
                      onClick={() => setKillTarget(process)}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <KillIcon />
                        Kill
                      </span>
                    </ActionButton>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-zinc-950/70 p-3">
                      <p className="text-[11px] text-zinc-600">CPU</p>

                      <p className="mt-1 text-sm font-medium">
                        {formatPercent(process.cpu_percent)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-zinc-950/70 p-3">
                      <p className="text-[11px] text-zinc-600">Memory</p>

                      <p className="mt-1 text-sm font-medium">
                        {formatPercent(process.memory_percent)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-zinc-950/70 p-3">
                      <p className="text-[11px] text-zinc-600">RSS</p>

                      <p className="mt-1 text-sm font-medium">
                        {formatBytes(process.memory_bytes)}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-zinc-600">
                    PPID {process.ppid} · UID {process.uid}
                  </p>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {killTarget && (
        <div
          className="fixed inset-0 z-[22000] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Terminate PID {killTarget.pid}?</h3>

            <p className="mt-3 text-sm leading-6 text-zinc-500">
              This process belongs to{" "}
              <span className="text-zinc-300">{killTarget.user ?? `UID ${killTarget.uid}`}</span>.
            </p>

            <div className="mt-4 rounded-xl bg-zinc-950/70 p-4">
              <p className="truncate font-mono text-xs text-zinc-400">{killTarget.command}</p>
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                disabled={busyKey !== "" && busyKey !== `${killTarget.pid}:TERM`}
                onClick={() => void runProcessKill(killTarget, "TERM")}
                className="rounded-xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:opacity-40"
              >
                {busyKey === `${killTarget.pid}:TERM` ? "Terminating…" : "Terminate gracefully"}
              </button>

              <button
                type="button"
                disabled={busyKey !== "" && busyKey !== `${killTarget.pid}:KILL`}
                onClick={() => void runProcessKill(killTarget, "KILL")}
                className="rounded-xl bg-red-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-40"
              >
                {busyKey === `${killTarget.pid}:KILL` ? "Force killing…" : "Force kill"}
              </button>

              <button
                type="button"
                disabled={busyKey !== ""}
                onClick={() => setKillTarget(null)}
                className="rounded-xl bg-zinc-800 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
