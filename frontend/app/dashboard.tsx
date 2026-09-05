"use client";

import { useEffect, useState } from "react";
import { getSnapshot } from "@/lib/api";

type Snapshot = Awaited<ReturnType<typeof getSnapshot>>;

type View = "dashboard" | "processes" | "services" | "system";

export default function Dashboard({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<View>("dashboard");

  useEffect(() => {
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

  const navigation: { id: View; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "processes", label: "Processes" },
    { id: "services", label: "Services" },
    { id: "system", label: "System" },
  ];

  const changeView = (nextView: View) => {
    setView(nextView);
    setMenuOpen(false);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Navigation trigger */}
      <button
        type="button"
        aria-label="Open navigation"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(true)}
        onPointerUp={() => setMenuOpen(true)}
        className="fixed left-4 top-4 z-[100] flex h-12 w-12 touch-manipulation items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 shadow-xl transition active:scale-95 hover:bg-zinc-800"
      >
        <span className="flex gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
        </span>
      </button>

      {/* Navigation drawer */}
      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
          />

          <aside className="fixed left-3 top-3 z-50 w-[280px] rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl">
            <div className="mb-5 flex items-center justify-between px-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
                  VPS Panel
                </p>

                <p className="mt-1 text-lg font-semibold">{snapshot.System.hostname}</p>
              </div>

              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation"
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                ×
              </button>
            </div>

            <nav className="space-y-2">
              {navigation.map((item) => {
                const active = view === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => changeView(item.id)}
                    className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                      active
                        ? "bg-zinc-100 text-zinc-950"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </aside>
        </>
      )}

      {/* Main content */}
      <div className="mx-auto min-h-screen w-full max-w-7xl px-5 pb-10 pt-20 sm:px-8 sm:pt-24">
        {/* Header */}
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

              <span>{lastUpdated.toLocaleTimeString()}</span>
            </div>
          </div>
        </header>

        {/* Dashboard */}
        {view === "dashboard" && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => changeView("dashboard")}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-800/80"
              >
                <p className="text-sm text-zinc-500">Users</p>
                <p className="mt-3 text-3xl font-semibold">{snapshot.Users.length}</p>
              </button>

              <button
                type="button"
                onClick={() => changeView("dashboard")}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-800/80"
              >
                <p className="text-sm text-zinc-500">Sessions</p>
                <p className="mt-3 text-3xl font-semibold">{snapshot.Sessions.length}</p>
              </button>

              <button
                type="button"
                onClick={() => changeView("processes")}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-800/80"
              >
                <p className="text-sm text-zinc-500">Processes</p>
                <p className="mt-3 text-3xl font-semibold">{snapshot.Processes.length}</p>

                <p className="mt-2 text-xs text-zinc-600">View processes →</p>
              </button>

              <button
                type="button"
                onClick={() => changeView("services")}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-800/80"
              >
                <p className="text-sm text-zinc-500">Services</p>
                <p className="mt-3 text-3xl font-semibold">{snapshot.Services.length}</p>

                <p className="mt-2 text-xs text-zinc-600">View services →</p>
              </button>
            </section>

            <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">System</h2>

                <p className="text-sm text-zinc-500">Server information</p>
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

        {/* Processes */}
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

        {/* Services */}
        {view === "services" && (
          <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            <div className="border-b border-zinc-800 p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Services</h2>

              <p className="mt-1 text-sm text-zinc-500">
                {snapshot.Services.length} system services
              </p>
            </div>

            <div className="divide-y divide-zinc-800">
              {snapshot.Services.map((service) => (
                <div key={service.name} className="p-4 transition hover:bg-zinc-800/40 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{service.name}</p>

                      <p className="mt-1 text-xs text-zinc-500">{service.description}</p>
                    </div>

                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs ${
                          service.active
                            ? "bg-green-400/10 text-green-400"
                            : "bg-zinc-800 text-zinc-500"
                        }`}
                      >
                        {service.active ? "Active" : "Inactive"}
                      </span>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs ${
                          service.enabled
                            ? "bg-blue-400/10 text-blue-400"
                            : "bg-zinc-800 text-zinc-500"
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

        {/* System */}
        {view === "system" && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8">
            <div>
              <h2 className="text-lg font-semibold">System</h2>

              <p className="mt-1 text-sm text-zinc-500">Detailed server information</p>
            </div>

            <dl className="mt-8 grid gap-7 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">Hostname</dt>
                <dd className="mt-2 text-sm">{snapshot.System.hostname}</dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">Operating system</dt>
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
        )}
      </div>
    </main>
  );
}
