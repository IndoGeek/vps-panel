"use client";

import { useEffect, useState } from "react";
import { getHealth, requestSystemPower, type Snapshot, type UserInfo } from "@/lib/api";

type PowerAction = "reboot" | "shutdown";

type PowerState =
  | "idle"
  | "confirm-reboot"
  | "confirm-shutdown"
  | "rebooting"
  | "shutting-down"
  | "reconnected"
  | "offline"
  | "error";

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

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${Math.round(value)}%`;
}

function formatUptime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "—";
  }

  const totalMinutes = Math.floor(seconds / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function CpuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path d="M9 9h6v6H9z" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    </svg>
  );
}

function MemoryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 9v6M11 9v6M15 9v6M19 9v6" />
      <path d="M3 10H1M3 14H1M23 10h-2M23 14h-2" />
    </svg>
  );
}

function DiskIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 3v5h8V3M8 17h8" />
      <circle cx="12" cy="14" r="1.5" />
    </svg>
  );
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

function ServerIcon() {
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

function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.5 3.1-5.5 7-5.5s6.2 2 7 5.5" />
    </svg>
  );
}

function RotateIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
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

function PowerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M12 3v9" />
      <path d="M6.6 5.9a8 8 0 1 0 10.8 0" />
    </svg>
  );
}

function CheckIcon() {
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
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const safeValue = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-zinc-600">{label}</span>

        <span className="text-zinc-500">{Math.round(safeValue)}%</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-zinc-950">
        <div
          className="h-full rounded-full bg-zinc-300 transition-all duration-500"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

function ResourceCard({
  title,
  value,
  subtitle,
  icon,
  progress,
  progressLabel,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  progress: number;
  progressLabel: string;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">{title}</p>

          <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>

          <p className="mt-2 text-xs text-zinc-500">{subtitle}</p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
          {icon}
        </div>
      </div>

      <ProgressBar value={progress} label={progressLabel} />
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-zinc-600">{label}</dt>

      <dd className="mt-2 truncate text-sm text-zinc-200">{value || "—"}</dd>
    </div>
  );
}

function PowerConfirmation({
  action,
  loading,
  onCancel,
  onConfirm,
}: {
  action: PowerAction;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const reboot = action === "reboot";

  return (
    <div
      className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="power-confirm-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              reboot ? "bg-yellow-400/10 text-yellow-400" : "bg-red-400/10 text-red-400"
            }`}
          >
            {reboot ? <RotateIcon /> : <PowerIcon />}
          </div>

          <div className="min-w-0">
            <h3 id="power-confirm-title" className="text-lg font-semibold text-zinc-100">
              {reboot ? "Reboot VPS?" : "Shut down VPS?"}
            </h3>

            <p className="mt-2 text-sm leading-6 text-zinc-500">
              {reboot
                ? "The VPS will restart. The web panel, terminal connections, and running workloads may become temporarily unavailable."
                : "The VPS will power off. The web panel and all running workloads will become unavailable until the VPS is started again."}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-zinc-500">
              <CheckIcon />
            </div>

            <p className="text-xs leading-5 text-zinc-500">
              {reboot
                ? "The panel will automatically wait for the server to come back online after the reboot."
                : "Make sure you have another way to start the VPS again before continuing."}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-full bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              reboot
                ? "bg-yellow-400 text-zinc-950 hover:bg-yellow-300"
                : "bg-red-500 text-white hover:bg-red-400"
            }`}
          >
            {loading
              ? reboot
                ? "Rebooting…"
                : "Shutting down…"
              : reboot
                ? "Reboot VPS"
                : "Shut down VPS"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PowerStatusOverlay({ state }: { state: PowerState }) {
  if (
    state !== "rebooting" &&
    state !== "shutting-down" &&
    state !== "offline" &&
    state !== "reconnected"
  ) {
    return null;
  }

  const rebooting = state === "rebooting";
  const reconnected = state === "reconnected";

  return (
    <div className="fixed inset-0 z-[19000] flex items-center justify-center bg-zinc-950/95 px-5 backdrop-blur-md">
      <div className="w-full max-w-md text-center">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${
            reconnected
              ? "bg-green-400/10 text-green-400"
              : rebooting
                ? "bg-yellow-400/10 text-yellow-400"
                : "bg-red-400/10 text-red-400"
          }`}
        >
          {reconnected ? (
            <CheckIcon />
          ) : rebooting ? (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-yellow-400" />
          ) : (
            <PowerIcon />
          )}
        </div>

        <h2 className="mt-6 text-xl font-semibold">
          {rebooting
            ? "Rebooting VPS…"
            : reconnected
              ? "VPS is back online"
              : "VPS is shutting down"}
        </h2>

        <p className="mt-3 text-sm leading-6 text-zinc-500">
          {rebooting
            ? "The panel will automatically reconnect when the server becomes available again."
            : reconnected
              ? "Reloading the panel…"
              : "The panel is now expected to become unavailable."}
        </p>

        {!rebooting && !reconnected && (
          <p className="mt-6 text-xs text-zinc-700">
            You can close this page. The VPS has received the shutdown request.
          </p>
        )}
      </div>
    </div>
  );
}

export default function SystemManagement({
  snapshot,
  user,
}: {
  snapshot: Snapshot;
  user: UserInfo;
}) {
  const [powerState, setPowerState] = useState<PowerState>("idle");
  const [pendingAction, setPendingAction] = useState<PowerAction | null>(null);
  const [powerError, setPowerError] = useState("");

  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    if (powerState !== "rebooting") {
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;

      try {
        await getHealth();

        if (cancelled) {
          return;
        }

        setPowerState("reconnected");

        window.setTimeout(() => {
          if (!cancelled) {
            window.location.reload();
          }
        }, 1000);

        return;
      } catch {
        if (cancelled) {
          return;
        }

        if (attempts >= 60) {
          setPowerState("error");
          setPowerError("The VPS has not responded after 2 minutes. Check the server externally.");

          return;
        }

        window.setTimeout(poll, 2000);
      }
    };

    const timer = window.setTimeout(poll, 2000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [powerState]);

  useEffect(() => {
    if (powerState !== "shutting-down") {
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      if (cancelled) {
        return;
      }

      try {
        await getHealth();

        if (!cancelled) {
          setPowerState("offline");
        }
      } catch {
        if (!cancelled) {
          setPowerState("offline");
        }
      }
    }, 3000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [powerState]);

  const requestPowerAction = (action: PowerAction) => {
    setPowerError("");
    setPendingAction(action);

    setPowerState(action === "reboot" ? "confirm-reboot" : "confirm-shutdown");
  };

  const cancelPowerAction = () => {
    if (confirmLoading) {
      return;
    }

    setPendingAction(null);
    setPowerState("idle");
  };

  const confirmPowerAction = async () => {
    if (!pendingAction) {
      return;
    }

    try {
      setConfirmLoading(true);
      setPowerError("");

      await requestSystemPower(pendingAction);

      setPendingAction(null);

      if (pendingAction === "reboot") {
        setPowerState("rebooting");
      } else {
        setPowerState("shutting-down");
      }
    } catch (error) {
      console.error("System power operation failed:", error);

      setPowerState("error");

      setPowerError(
        error instanceof Error
          ? error.message
          : "Unable to perform the requested system operation.",
      );
    } finally {
      setConfirmLoading(false);
    }
  };

  const cpu = snapshot.Metrics.cpu_percent;
  const memory = snapshot.Metrics.memory_percent;
  const disk = snapshot.Metrics.disk_percent;

  const powerDialog = powerState === "confirm-reboot" || powerState === "confirm-shutdown";

  return (
    <>
      <div className="space-y-6">
        {powerState === "error" && powerError && (
          <section className="flex items-start justify-between gap-4 rounded-2xl border border-red-400/20 bg-red-400/5 p-5">
            <div>
              <p className="text-sm font-medium text-red-300">System operation failed</p>

              <p className="mt-2 text-sm leading-6 text-red-400/80">{powerError}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setPowerState("idle");
                setPowerError("");
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-red-400/70 transition hover:bg-red-400/10 hover:text-red-300"
              aria-label="Dismiss error"
            >
              <XIcon />
            </button>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
                <ServerIcon />
              </div>

              <div>
                <h2 className="text-lg font-semibold">System information</h2>

                <p className="mt-1 text-sm text-zinc-500">Operating system and Linux identity</p>
              </div>
            </div>
          </div>

          <dl className="grid gap-x-8 gap-y-7 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
            <InfoRow label="Hostname" value={snapshot.System.hostname} />

            <InfoRow label="Operating system" value={snapshot.System.os} />

            <InfoRow label="Architecture" value={snapshot.System.architecture} />

            <InfoRow label="Kernel" value={snapshot.System.kernel} />

            <InfoRow label="Linux user" value={`${user.username} · UID ${user.uid}`} />

            <InfoRow label="Home directory" value={user.home_dir} />

            <InfoRow label="Shell" value={user.shell} />

            <InfoRow label="Uptime" value={formatUptime(snapshot.Metrics.uptime_seconds)} />

            <InfoRow
              label="Load average"
              value={`${snapshot.Metrics.load_1.toFixed(2)} / ${snapshot.Metrics.load_5.toFixed(2)} / ${snapshot.Metrics.load_15.toFixed(2)}`}
            />
          </dl>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Resources</h2>

            <p className="mt-1 text-sm text-zinc-500">Current VPS resource utilization</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ResourceCard
              title="CPU"
              value={formatPercent(cpu)}
              subtitle={`${snapshot.Metrics.load_1.toFixed(2)} current load`}
              icon={<CpuIcon />}
              progress={cpu}
              progressLabel="CPU utilization"
            />

            <ResourceCard
              title="Memory"
              value={formatPercent(memory)}
              subtitle={`${formatBytes(snapshot.Metrics.memory_used_bytes)} of ${formatBytes(snapshot.Metrics.memory_total_bytes)}`}
              icon={<MemoryIcon />}
              progress={memory}
              progressLabel="Memory utilization"
            />

            <ResourceCard
              title="Disk"
              value={formatPercent(disk)}
              subtitle={`${formatBytes(snapshot.Metrics.disk_used_bytes)} of ${formatBytes(snapshot.Metrics.disk_total_bytes)}`}
              icon={<DiskIcon />}
              progress={disk}
              progressLabel="Root filesystem"
            />

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-zinc-500">System load</p>

                  <p className="mt-3 text-3xl font-semibold tracking-tight">
                    {snapshot.Metrics.load_1.toFixed(2)}
                  </p>

                  <p className="mt-2 text-xs text-zinc-500">1m / 5m / 15m load average</p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
                  <ActivityIcon />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-zinc-950/70 p-3">
                  <p className="text-xs text-zinc-600">Uptime</p>

                  <p className="mt-1 text-sm font-medium">
                    {formatUptime(snapshot.Metrics.uptime_seconds)}
                  </p>
                </div>

                <div className="rounded-xl bg-zinc-950/70 p-3">
                  <p className="text-xs text-zinc-600">Swap</p>

                  <p className="mt-1 text-sm font-medium">
                    {formatPercent(snapshot.Metrics.swap_percent)}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
                <PowerIcon />
              </div>

              <div>
                <h2 className="text-lg font-semibold">Power controls</h2>

                <p className="mt-1 text-sm text-zinc-500">Control the VPS power state</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <button
              type="button"
              disabled={powerState !== "idle" && powerState !== "error"}
              onClick={() => requestPowerAction("reboot")}
              className="flex min-h-24 items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-800/70 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-400">
                <RotateIcon />
              </div>

              <div>
                <p className="font-medium text-zinc-200">Reboot VPS</p>

                <p className="mt-1 text-xs leading-5 text-zinc-600">Restart the entire server</p>
              </div>
            </button>

            <button
              type="button"
              disabled={powerState !== "idle" && powerState !== "error"}
              onClick={() => requestPowerAction("shutdown")}
              className="flex min-h-24 items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 text-left transition hover:border-red-400/30 hover:bg-red-400/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-400/10 text-red-400">
                <PowerIcon />
              </div>

              <div>
                <p className="font-medium text-zinc-200">Shut down VPS</p>

                <p className="mt-1 text-xs leading-5 text-zinc-600">Power off the entire server</p>
              </div>
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
              <UserIcon />
            </div>

            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Authenticated Linux identity</h2>

              <p className="mt-1 text-sm text-zinc-500">
                The Linux identity associated with your panel session.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-600">Username</p>

                  <p className="mt-2 truncate text-sm">{user.username}</p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-600">UID / GID</p>

                  <p className="mt-2 text-sm">
                    {user.uid} / {user.gid}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-600">Shell</p>

                  <p className="mt-2 truncate font-mono text-sm">{user.shell}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {powerDialog && pendingAction && (
        <PowerConfirmation
          action={pendingAction}
          loading={confirmLoading}
          onCancel={cancelPowerAction}
          onConfirm={confirmPowerAction}
        />
      )}

      <PowerStatusOverlay state={powerState} />
    </>
  );
}
