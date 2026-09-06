"use client";

import { useEffect, useMemo, useState } from "react";

import { getAuditLogs, getSnapshot, logout, type AuditEntry, type UserInfo } from "@/lib/api";

import SessionManagement from "@/app/components/SessionManagement";

import SystemManagement, {
  SystemPowerControls,
  SystemResourceGrid,
} from "@/app/components/SystemManagement";

type Snapshot = Awaited<ReturnType<typeof getSnapshot>>;

type View = "dashboard" | "processes" | "sessions" | "services" | "system" | "audit";

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];

  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  if (unit === 0) {
    return `${Math.round(value)} ${units[unit]}`;
  }

  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unit]}`;
}

function ActivityIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3 12h4l2-6 4 12 2-6h6" />
    </svg>
  );
}

function ServiceIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();

  if (
    lower.includes("nginx") ||
    lower.includes("apache") ||
    lower.includes("caddy") ||
    lower.includes("traefik")
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M6 4h12l2 4-8 12L4 8z" />
        <path d="M8 8h8M9 12h6M10 16h4" />
      </svg>
    );
  }

  if (lower.includes("redis") || lower.includes("memcached")) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <ellipse cx="12" cy="6" rx="7" ry="3" />
        <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
        <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
      </svg>
    );
  }

  if (
    lower.includes("mysql") ||
    lower.includes("mariadb") ||
    lower.includes("postgres") ||
    lower.includes("mongodb")
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <ellipse cx="12" cy="5" rx="7" ry="3" />
        <path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
        <path d="M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" />
      </svg>
    );
  }

  if (lower.includes("ssh") || lower.includes("sshd")) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m7 10 3 2-3 2M12 15h5" />
      </svg>
    );
  }

  if (lower.includes("docker") || lower.includes("containerd")) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M3 13h14M5 10h3M9 10h3M13 10h3M7 7h3M11 7h3" />
        <path d="M18 11c2 0 3 1 3 2.5 0 1.8-2 3.5-5 3.5H7c-2 0-3-1-3-3" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

function DashboardActionButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full bg-zinc-100 px-4 py-2.5 text-xs font-semibold text-zinc-900 transition hover:bg-white active:scale-[0.98]"
      style={{
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}
    >
      {children}
    </button>
  );
}

export default function Dashboard({
  initialSnapshot,
  user,
}: {
  initialSnapshot: Snapshot;
  user: UserInfo;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);

  const [view, setView] = useState<View>("dashboard");

  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);

  const [auditTotal, setAuditTotal] = useState(0);

  const [auditOffset, setAuditOffset] = useState(0);

  const [auditLoading, setAuditLoading] = useState(false);

  const [auditError, setAuditError] = useState("");

  const [auditAction, setAuditAction] = useState("");

  const [auditStatus, setAuditStatus] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const requestedView = params.get("view");

    if (
      requestedView === "dashboard" ||
      requestedView === "processes" ||
      requestedView === "sessions" ||
      requestedView === "services" ||
      requestedView === "system" ||
      requestedView === "audit"
    ) {
      setView(requestedView);
    }
  }, []);

  /*
   * Keep the existing live snapshot refresh.
   *
   * The old dashboard metric-history/sparkline state has deliberately been
   * removed. The Dashboard now renders the same live resource cards used by
   * SystemManagement.
   */
  useEffect(() => {
    setLastUpdated(new Date());

    const refresh = async () => {
      try {
        setRefreshing(true);

        const nextSnapshot = await getSnapshot();

        setSnapshot(nextSnapshot);
        setLastUpdated(new Date());
      } catch (error) {
        console.error("Failed to refresh VPS snapshot:", error);
      } finally {
        setRefreshing(false);
      }
    };

    const interval = setInterval(refresh, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (view !== "audit") {
      return;
    }

    let cancelled = false;

    const loadAudit = async () => {
      try {
        setAuditLoading(true);
        setAuditError("");

        const result = await getAuditLogs({
          limit: 50,
          offset: auditOffset,
          action: auditAction,
          status: auditStatus,
        });

        if (cancelled) {
          return;
        }

        setAuditEntries(result.entries);
        setAuditTotal(result.total);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Failed to load audit logs:", error);

        if (error instanceof Error && error.message === "UNAUTHORIZED") {
          window.location.reload();
          return;
        }

        setAuditError("Unable to load audit logs.");
      } finally {
        if (!cancelled) {
          setAuditLoading(false);
        }
      }
    };

    void loadAudit();

    return () => {
      cancelled = true;
    };
  }, [view, auditOffset, auditAction, auditStatus]);

  useEffect(() => {
    if (view !== "audit") {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const result = await getAuditLogs({
          limit: 50,
          offset: auditOffset,
          action: auditAction,
          status: auditStatus,
        });

        setAuditEntries(result.entries);
        setAuditTotal(result.total);
      } catch (error) {
        console.error("Failed to refresh audit logs:", error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [view, auditOffset, auditAction, auditStatus]);

  const navigation: {
    id: View;
    label: string;
  }[] = [
    {
      id: "dashboard",
      label: "Dashboard",
    },
    {
      id: "processes",
      label: "Processes",
    },
    {
      id: "sessions",
      label: "Sessions",
    },
    {
      id: "services",
      label: "Services",
    },
    {
      id: "system",
      label: "System",
    },
    {
      id: "audit",
      label: "Audit",
    },
  ];

  const changeView = (nextView: View) => {
    setView(nextView);
    setMenuOpen(false);

    const url = new URL(window.location.href);

    if (nextView === "dashboard") {
      url.searchParams.delete("view");
    } else {
      url.searchParams.set("view", nextView);
    }

    window.history.replaceState({}, "", url.toString());
  };

  const openTerminal = (sessionName: string) => {
    window.location.href = `/terminal?session=${encodeURIComponent(sessionName)}`;
  };

  const activeServices = useMemo(
    () => snapshot.Services.filter((service) => service.active).length,
    [snapshot.Services],
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {!menuOpen && (
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={false}
          onClick={() => setMenuOpen(true)}
          className="fixed left-[18px] top-[18px] z-[10000] flex h-[50px] w-[50px] items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 shadow-xl transition hover:bg-zinc-800 active:scale-95"
          style={{
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
        >
          <span className="flex items-center justify-center gap-1">
            <span className="h-[5px] w-[5px] rounded-full bg-zinc-300" />
            <span className="h-[5px] w-[5px] rounded-full bg-zinc-300" />
            <span className="h-[5px] w-[5px] rounded-full bg-zinc-300" />
          </span>
        </button>
      )}

      <button
        type="button"
        aria-label="Close navigation"
        tabIndex={menuOpen ? 0 : -1}
        onClick={() => setMenuOpen(false)}
        className="fixed inset-0 z-[9990] border-0 bg-black/60 p-0"
        style={{
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? "auto" : "none",
          transition: "opacity 180ms ease",
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        }}
      />

      <aside
        aria-hidden={!menuOpen}
        className="fixed left-0 top-0 z-[9995] h-screen w-[290px] max-w-[85vw] overflow-y-auto rounded-r-[24px] border-r border-zinc-800 bg-zinc-900 shadow-[20px_0_60px_rgba(0,0,0,0.50)]"
        style={{
          transform: menuOpen ? "translateX(0)" : "translateX(-105%)",
          transition: "transform 220ms ease",
        }}
      >
        <div className="flex items-center justify-between px-6 pb-8 pt-7">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">VPS Panel</p>

            <p className="mt-1 text-lg font-semibold">{snapshot.System.hostname}</p>

            <p className="mt-2 text-xs text-zinc-500">
              {user.username} · UID {user.uid}
            </p>
          </div>

          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 active:scale-95"
            style={{
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
            }}
          >
            ×
          </button>
        </div>

        <nav className="space-y-3 px-4">
          {navigation.map((item) => {
            const active = view === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => changeView(item.id)}
                className="flex min-h-12 w-full items-center rounded-full px-[18px] text-left text-sm font-medium transition active:scale-[0.98]"
                style={{
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation",
                  background: active ? "rgb(244, 244, 245)" : "rgb(39, 39, 42)",
                  color: active ? "rgb(24, 24, 27)" : "rgb(212, 212, 216)",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-4 pb-6 pt-8">
          <button
            type="button"
            onClick={async () => {
              await logout();
              window.location.reload();
            }}
            className="flex min-h-12 w-full items-center rounded-full bg-zinc-800 px-[18px] text-left text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 active:scale-[0.98]"
            style={{
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="mx-auto min-h-screen w-full max-w-7xl px-5 pb-10 pt-24 sm:px-8 sm:pt-28">
        <header className="mb-8">
          <p className="text-sm text-zinc-500">
            {navigation.find((item) => item.id === view)?.label}
          </p>

          <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {snapshot.System.hostname}
              </h1>

              <p className="mt-2 text-sm text-zinc-400">
                {snapshot.System.os} · {snapshot.System.architecture}
              </p>
            </div>

            <div className="flex w-fit items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
              <span
                className={`h-2 w-2 rounded-full ${refreshing ? "bg-yellow-400" : "bg-green-400"}`}
              />

              <span>{refreshing ? "Updating" : "Live"}</span>

              <span className="text-zinc-700">•</span>

              <span suppressHydrationWarning>
                {lastUpdated ? lastUpdated.toLocaleTimeString() : "—"}
              </span>
            </div>
          </div>
        </header>

        {view === "dashboard" && (
          <>
            {/* ------------------------------------------------------------
             * Current VPS resource utilization
             * ------------------------------------------------------------ */}

            <SystemResourceGrid snapshot={snapshot} />

            {/* ------------------------------------------------------------
             * Power controls
             * ------------------------------------------------------------ */}

            <div className="mt-6">
              <SystemPowerControls />
            </div>

            {/* ------------------------------------------------------------
             * Quick management cards
             * ------------------------------------------------------------ */}

            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {/* Services */}

              <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-500">Services</p>

                    <p className="mt-3 text-3xl font-semibold">{snapshot.Services.length}</p>

                    <span className="mt-3 inline-flex rounded-full bg-green-400/10 px-2.5 py-1 text-xs text-green-400">
                      {activeServices} active
                    </span>
                  </div>

                  <DashboardActionButton onClick={() => changeView("services")}>
                    View services →
                  </DashboardActionButton>
                </div>
              </section>

              {/* Processes */}

              <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-500">Processes</p>

                    <p className="mt-3 text-3xl font-semibold">{snapshot.Processes.length}</p>
                  </div>

                  <DashboardActionButton onClick={() => changeView("processes")}>
                    View processes →
                  </DashboardActionButton>
                </div>
              </section>

              {/* Tmux */}

              <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-500">Tmux Sessions</p>

                    <p className="mt-3 text-3xl font-semibold">{snapshot.Sessions.length}</p>
                  </div>

                  <DashboardActionButton onClick={() => changeView("sessions")}>
                    Open terminal →
                  </DashboardActionButton>
                </div>
              </section>

              {/* Network */}

              <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-zinc-500">Network</p>

                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="text-xs text-zinc-600">Received</p>

                        <p className="mt-1 text-sm font-medium">
                          {formatBytes(snapshot.Metrics.network_rx_bytes)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-zinc-600">Transmitted</p>

                        <p className="mt-1 text-sm font-medium">
                          {formatBytes(snapshot.Metrics.network_tx_bytes)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </section>

            {/* ------------------------------------------------------------
             * Compact system information
             * ------------------------------------------------------------ */}

            <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">System</h2>

                  <p className="mt-1 text-sm text-zinc-500">Server information</p>
                </div>

                <DashboardActionButton onClick={() => changeView("system")}>
                  Details →
                </DashboardActionButton>
              </div>

              <dl className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Hostname</dt>

                  <dd className="mt-2 text-sm">{snapshot.System.hostname}</dd>
                </div>

                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">
                    Operating system
                  </dt>

                  <dd className="mt-2 text-sm">{snapshot.System.os}</dd>
                </div>

                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Architecture</dt>

                  <dd className="mt-2 text-sm">{snapshot.System.architecture}</dd>
                </div>

                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Kernel</dt>

                  <dd className="mt-2 text-sm">{snapshot.System.kernel}</dd>
                </div>
              </dl>
            </section>
          </>
        )}

        {/* --------------------------------------------------------------
         * Processes
         * -------------------------------------------------------------- */}

        {view === "processes" && (
          <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            <div className="border-b border-zinc-800 p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Processes</h2>

              <p className="mt-1 text-sm text-zinc-500">
                {snapshot.Processes.length} running processes
              </p>
            </div>

            <div className="divide-y divide-zinc-800">
              {snapshot.Processes.map((process) => (
                <div key={process.pid} className="p-4 transition hover:bg-zinc-800/40 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm text-zinc-200">{process.command}</p>

                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                        <span className="rounded-full bg-zinc-800 px-2.5 py-1">
                          PID {process.pid}
                        </span>

                        <span className="rounded-full bg-zinc-800 px-2.5 py-1">
                          PPID {process.ppid}
                        </span>

                        <span className="rounded-full bg-zinc-800 px-2.5 py-1">
                          UID {process.uid}
                        </span>
                      </div>
                    </div>

                    <span className="w-fit rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
                      {process.state}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* --------------------------------------------------------------
         * Sessions
         * -------------------------------------------------------------- */}

        {view === "sessions" && <SessionManagement onOpenTerminal={openTerminal} />}

        {/* --------------------------------------------------------------
         * Services
         * -------------------------------------------------------------- */}

        {view === "services" && (
          <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            <div className="border-b border-zinc-800 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Services</h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    {activeServices} active · {snapshot.Services.length} total
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
                  <ActivityIcon />
                </div>
              </div>
            </div>

            <div className="divide-y divide-zinc-800">
              {snapshot.Services.map((service) => (
                <div key={service.name} className="p-4 transition hover:bg-zinc-800/40 sm:p-5">
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        service.active
                          ? "bg-green-400/10 text-green-400"
                          : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      <ServiceIcon name={service.name} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                        <p className="truncate text-sm font-medium">{service.name}</p>

                        <span
                          className={`w-fit rounded-full px-2.5 py-1 text-[11px] ${
                            service.active
                              ? "bg-green-400/10 text-green-400"
                              : "bg-zinc-800 text-zinc-500"
                          }`}
                        >
                          {service.active ? "Running" : "Stopped"}
                        </span>
                      </div>

                      <p className="mt-1 truncate text-xs text-zinc-500">
                        {service.description || "System service"}
                      </p>
                    </div>

                    <div className="hidden shrink-0 sm:block">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs ${
                          service.enabled
                            ? "bg-blue-400/10 text-blue-400"
                            : "bg-zinc-800 text-zinc-600"
                        }`}
                      >
                        {service.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* --------------------------------------------------------------
         * Audit
         * -------------------------------------------------------------- */}

        {view === "audit" && (
          <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            <div className="border-b border-zinc-800 p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Audit Log</h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    Security and administrative events recorded by the panel.
                  </p>
                </div>

                <span className="w-fit rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
                  {auditTotal} {auditTotal === 1 ? "event" : "events"}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-wide text-zinc-500">
                    Action
                  </span>

                  <select
                    value={auditAction}
                    onChange={(event) => {
                      setAuditAction(event.target.value);

                      setAuditOffset(0);
                    }}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-600"
                  >
                    <option value="">All actions</option>

                    <option value="auth.login">Login</option>

                    <option value="auth.logout">Logout</option>

                    <option value="terminal.connect">Terminal connect</option>

                    <option value="terminal.disconnect">Terminal disconnect</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-wide text-zinc-500">
                    Status
                  </span>

                  <select
                    value={auditStatus}
                    onChange={(event) => {
                      setAuditStatus(event.target.value);

                      setAuditOffset(0);
                    }}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-600"
                  >
                    <option value="">All statuses</option>

                    <option value="success">Success</option>

                    <option value="failure">Failure</option>

                    <option value="denied">Denied</option>
                  </select>
                </label>
              </div>
            </div>

            {auditError && (
              <div className="border-b border-zinc-800 p-5 text-sm text-red-400">{auditError}</div>
            )}

            {auditLoading && auditEntries.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">Loading audit log…</div>
            ) : auditEntries.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-zinc-400">No audit events found.</p>

                <p className="mt-2 text-xs text-zinc-600">
                  Events will appear here when users sign in, sign out, or open terminals.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {auditEntries.map((entry) => (
                  <article key={entry.id} className="p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs ${
                              entry.status === "success"
                                ? "bg-green-400/10 text-green-400"
                                : entry.status === "denied"
                                  ? "bg-yellow-400/10 text-yellow-400"
                                  : "bg-red-400/10 text-red-400"
                            }`}
                          >
                            {entry.status}
                          </span>

                          <span className="font-mono text-sm text-zinc-200">{entry.action}</span>
                        </div>

                        <p className="mt-3 text-sm text-zinc-300">
                          {entry.resource_name
                            ? `${entry.resource_type}: ${entry.resource_name}`
                            : entry.details || "Panel event"}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                          <span className="rounded-full bg-zinc-800 px-2.5 py-1">
                            User {entry.username || "unknown"}
                          </span>

                          {entry.ip_address && (
                            <span className="rounded-full bg-zinc-800 px-2.5 py-1">
                              IP {entry.ip_address}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-xs text-zinc-500 lg:text-right">
                        <p>{new Date(entry.created_at).toLocaleString()}</p>

                        {entry.details && (
                          <p className="mt-1 max-w-md text-zinc-600">{entry.details}</p>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-zinc-800 p-4">
              <button
                type="button"
                disabled={auditOffset === 0 || auditLoading}
                onClick={() => setAuditOffset(Math.max(0, auditOffset - 50))}
                className="rounded-full bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Newer
              </button>

              <span className="text-xs text-zinc-600">
                {auditTotal === 0
                  ? "0"
                  : `${auditOffset + 1}–${Math.min(auditOffset + 50, auditTotal)}`}
              </span>

              <button
                type="button"
                disabled={auditOffset + 50 >= auditTotal || auditLoading}
                onClick={() => setAuditOffset(auditOffset + 50)}
                className="rounded-full bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Older →
              </button>
            </div>
          </section>
        )}

        {/* --------------------------------------------------------------
         * System
         * -------------------------------------------------------------- */}
        {view === "system" && <SystemManagement snapshot={snapshot} user={user} />}
      </div>
    </main>
  );
}
