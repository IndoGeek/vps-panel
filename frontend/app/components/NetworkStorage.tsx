"use client";

import type { FilesystemInfo, NetworkInterfaceInfo, Snapshot } from "@/lib/api";

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

function NetworkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="6" rx="2" />
      <rect x="3" y="14" width="18" height="6" rx="2" />
      <path d="M7 7h.01M7 17h.01M11 7h6M11 17h6" />
    </svg>
  );
}

function StorageIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 4h14l2 4v11H3V8l2-4Z" />
      <path d="M3 8h18" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 4v15" />
      <path d="m6 13 6 6 6-6" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20V5" />
      <path d="m6 11 6-6 6 6" />
    </svg>
  );
}

function StorageSummaryCard({
  snapshot,
  onViewSystem,
}: {
  snapshot: Snapshot;
  onViewSystem: () => void;
}) {
  const rootFilesystem =
    snapshot.Filesystems.find((filesystem) => filesystem.mount_point === "/") ??
    snapshot.Filesystems[0];

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-zinc-500">Storage</p>

          <p className="mt-3 text-3xl font-semibold">
            {rootFilesystem ? formatPercent(rootFilesystem.used_percent) : "—"}
          </p>

          <p className="mt-2 text-xs text-zinc-500">
            {snapshot.Filesystems.length} filesystem
            {snapshot.Filesystems.length === 1 ? "" : "s"} mounted
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
          <StorageIcon />
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-zinc-950/70 p-3">
        <p className="text-xs text-zinc-600">Root filesystem</p>

        <p className="mt-1 truncate text-sm font-medium text-zinc-200">
          {rootFilesystem?.mount_point ?? "—"}
        </p>

        <p className="mt-1 text-xs text-zinc-600">
          {rootFilesystem
            ? `${formatBytes(rootFilesystem.used_bytes)} of ${formatBytes(rootFilesystem.total_bytes)}`
            : "No filesystem data"}
        </p>
      </div>

      {rootFilesystem && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-zinc-950">
            <div
              className="h-full rounded-full bg-zinc-300 transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(0, rootFilesystem.used_percent))}%`,
              }}
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onViewSystem}
        className="mt-4 rounded-full bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100"
        style={{
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        }}
      >
        View filesystems →
      </button>
    </section>
  );
}

function InterfaceCard({ item }: { item: NetworkInterfaceInfo }) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-zinc-200">{item.name}</h3>

            <span
              className={`rounded-full px-2.5 py-1 text-xs ${
                item.state === "up"
                  ? "bg-green-400/10 text-green-400"
                  : item.state === "loopback"
                    ? "bg-zinc-800 text-zinc-500"
                    : "bg-red-400/10 text-red-400"
              }`}
            >
              {item.state}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
            <span>MTU {item.mtu}</span>

            {item.mac && <span className="font-mono">{item.mac}</span>}
          </div>
        </div>

        {item.loopback && (
          <span className="w-fit rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-500">
            Loopback
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-600">IPv4</p>

          <div className="mt-2 flex flex-wrap gap-2">
            {item.ipv4.length === 0 ? (
              <span className="text-sm text-zinc-700">None</span>
            ) : (
              item.ipv4.map((address) => (
                <span
                  key={address}
                  className="rounded-lg bg-zinc-900 px-2.5 py-1.5 font-mono text-xs text-zinc-300"
                >
                  {address}
                </span>
              ))
            )}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-600">IPv6</p>

          <div className="mt-2 flex flex-wrap gap-2">
            {item.ipv6.length === 0 ? (
              <span className="text-sm text-zinc-700">None</span>
            ) : (
              item.ipv6.map((address) => (
                <span
                  key={address}
                  className="rounded-lg bg-zinc-900 px-2.5 py-1.5 font-mono text-xs text-zinc-300"
                >
                  {address}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-zinc-900 p-3">
          <div className="flex items-center gap-1.5 text-zinc-600">
            <ArrowDownIcon />

            <span className="text-xs">Received</span>
          </div>

          <p className="mt-1 text-sm font-medium text-zinc-200">{formatBytes(item.rx_bytes)}</p>

          <p className="mt-1 text-xs text-zinc-700">{item.rx_packets.toLocaleString()} packets</p>
        </div>

        <div className="rounded-xl bg-zinc-900 p-3">
          <div className="flex items-center gap-1.5 text-zinc-600">
            <ArrowUpIcon />

            <span className="text-xs">Transmitted</span>
          </div>

          <p className="mt-1 text-sm font-medium text-zinc-200">{formatBytes(item.tx_bytes)}</p>

          <p className="mt-1 text-xs text-zinc-700">{item.tx_packets.toLocaleString()} packets</p>
        </div>
      </div>
    </article>
  );
}

function FilesystemCard({ item }: { item: FilesystemInfo }) {
  const percent = Math.min(100, Math.max(0, item.used_percent));

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-zinc-200">{item.mount_point}</h3>

            {item.read_only && (
              <span className="rounded-full bg-yellow-400/10 px-2.5 py-1 text-xs text-yellow-400">
                Read-only
              </span>
            )}
          </div>

          <p className="mt-2 truncate font-mono text-xs text-zinc-600">{item.device}</p>
        </div>

        <span className="w-fit rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-500">
          {item.type}
        </span>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-600">Disk usage</span>

          <span className="text-zinc-400">{formatPercent(percent)}</span>
        </div>

        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-900">
          <div
            className="h-full rounded-full bg-zinc-300 transition-all duration-500"
            style={{
              width: `${percent}%`,
            }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-zinc-600">Used</p>

          <p className="mt-1 text-sm text-zinc-300">{formatBytes(item.used_bytes)}</p>
        </div>

        <div>
          <p className="text-xs text-zinc-600">Available</p>

          <p className="mt-1 text-sm text-zinc-300">{formatBytes(item.available_bytes)}</p>
        </div>

        <div>
          <p className="text-xs text-zinc-600">Total</p>

          <p className="mt-1 text-sm text-zinc-300">{formatBytes(item.total_bytes)}</p>
        </div>
      </div>
    </article>
  );
}

function NetworkSummaryCardInternal({
  snapshot,
  onViewSystem,
}: {
  snapshot: Snapshot;
  onViewSystem: () => void;
}) {
  return <NetworkSummaryCardContent snapshot={snapshot} onViewSystem={onViewSystem} />;
}

function NetworkSummaryCardContent({
  snapshot,
  onViewSystem,
}: {
  snapshot: Snapshot;
  onViewSystem: () => void;
}) {
  return <NetworkSummaryCardBase snapshot={snapshot} onViewSystem={onViewSystem} />;
}

function NetworkSummaryCardBase({
  snapshot,
  onViewSystem,
}: {
  snapshot: Snapshot;
  onViewSystem: () => void;
}) {
  return <NetworkSummaryCardView snapshot={snapshot} onViewSystem={onViewSystem} />;
}

function NetworkSummaryCardView({
  snapshot,
  onViewSystem,
}: {
  snapshot: Snapshot;
  onViewSystem: () => void;
}) {
  return <NetworkSummaryCardRender snapshot={snapshot} onViewSystem={onViewSystem} />;
}

function NetworkSummaryCardRender({
  snapshot,
  onViewSystem,
}: {
  snapshot: Snapshot;
  onViewSystem: () => void;
}) {
  return <NetworkSummaryCardActual snapshot={snapshot} onViewSystem={onViewSystem} />;
}

function NetworkSummaryCardActual({
  snapshot,
  onViewSystem,
}: {
  snapshot: Snapshot;
  onViewSystem: () => void;
}) {
  const interfaces = snapshot.Network;
  const activeInterfaces = interfaces.filter((item) => item.state === "up" && !item.loopback);

  const primaryInterface =
    activeInterfaces.find((item) => item.ipv4.length > 0) ?? activeInterfaces[0] ?? interfaces[0];

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-zinc-500">Network</p>

          <p className="mt-3 text-3xl font-semibold">{activeInterfaces.length}</p>

          <p className="mt-2 text-xs text-zinc-500">
            active interface{activeInterfaces.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
          <NetworkIcon />
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-zinc-950/70 p-3">
        <p className="text-xs text-zinc-600">Primary interface</p>

        <p className="mt-1 truncate text-sm font-medium text-zinc-200">
          {primaryInterface?.name ?? "—"}
        </p>

        <p className="mt-1 truncate text-xs text-zinc-600">
          {primaryInterface?.ipv4[0] ?? primaryInterface?.ipv6[0] ?? "No IP address"}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-zinc-950/70 p-3">
          <p className="text-xs text-zinc-600">Received</p>

          <p className="mt-1 text-sm font-medium text-zinc-200">
            {formatBytes(snapshot.Metrics.network_rx_bytes)}
          </p>
        </div>

        <div className="rounded-xl bg-zinc-950/70 p-3">
          <p className="text-xs text-zinc-600">Transmitted</p>

          <p className="mt-1 text-sm font-medium text-zinc-200">
            {formatBytes(snapshot.Metrics.network_tx_bytes)}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onViewSystem}
        className="mt-4 rounded-full bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100"
        style={{
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        }}
      >
        View interfaces →
      </button>
    </section>
  );
}

export function NetworkSummaryCard({
  snapshot,
  onViewSystem,
}: {
  snapshot: Snapshot;
  onViewSystem: () => void;
}) {
  const interfaces = snapshot.Network;

  const activeInterfaces = interfaces.filter((item) => item.state === "up" && !item.loopback);

  const primaryInterface =
    activeInterfaces.find((item) => item.ipv4.length > 0) ?? activeInterfaces[0] ?? interfaces[0];

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-zinc-500">Network</p>

          <p className="mt-3 text-3xl font-semibold">{activeInterfaces.length}</p>

          <p className="mt-2 text-xs text-zinc-500">
            active interface{activeInterfaces.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
          <NetworkIcon />
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-zinc-950/70 p-3">
        <p className="text-xs text-zinc-600">Primary interface</p>

        <p className="mt-1 truncate text-sm font-medium text-zinc-200">
          {primaryInterface?.name ?? "—"}
        </p>

        <p className="mt-1 truncate text-xs text-zinc-600">
          {primaryInterface?.ipv4[0] ?? primaryInterface?.ipv6[0] ?? "No IP address"}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-zinc-950/70 p-3">
          <p className="text-xs text-zinc-600">Received</p>

          <p className="mt-1 text-sm font-medium text-zinc-200">
            {formatBytes(snapshot.Metrics.network_rx_bytes)}
          </p>
        </div>

        <div className="rounded-xl bg-zinc-950/70 p-3">
          <p className="text-xs text-zinc-600">Transmitted</p>

          <p className="mt-1 text-sm font-medium text-zinc-200">
            {formatBytes(snapshot.Metrics.network_tx_bytes)}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onViewSystem}
        className="mt-4 rounded-full bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100"
        style={{
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        }}
      >
        View interfaces →
      </button>
    </section>
  );
}

export function NetworkStorageDetails({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
              <NetworkIcon />
            </div>

            <div>
              <h2 className="text-lg font-semibold">Network interfaces</h2>

              <p className="mt-1 text-sm text-zinc-500">
                Interfaces, addresses and traffic counters
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          {snapshot.Network.length === 0 ? (
            <div className="rounded-2xl bg-zinc-950/70 p-6 text-center">
              <p className="text-sm text-zinc-400">No network interfaces were reported.</p>
            </div>
          ) : (
            snapshot.Network.map((item) => <InterfaceCard key={item.name} item={item} />)
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
              <StorageIcon />
            </div>

            <div>
              <h2 className="text-lg font-semibold">Filesystems</h2>

              <p className="mt-1 text-sm text-zinc-500">
                Mount points, filesystem types and disk usage
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          {snapshot.Filesystems.length === 0 ? (
            <div className="rounded-2xl bg-zinc-950/70 p-6 text-center">
              <p className="text-sm text-zinc-400">No filesystems were reported.</p>
            </div>
          ) : (
            snapshot.Filesystems.map((item) => (
              <FilesystemCard key={`${item.mount_point}:${item.device}`} item={item} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
