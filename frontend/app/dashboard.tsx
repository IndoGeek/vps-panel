"use client";

import { useEffect, useState } from "react";
import { getSnapshot } from "@/lib/api";

type Snapshot = Awaited<ReturnType<typeof getSnapshot>>;

type View = "dashboard" | "processes" | "sessions" | "services" | "system";

import { logout, type UserInfo } from "@/lib/api";

export default function Dashboard({
  initialSnapshot,
  user,
}: {
  initialSnapshot: Snapshot;
  user: UserInfo;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  // Keep the initial server/client render identical.
  // The timestamp is populated after hydration.
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<View>("dashboard");

  useEffect(() => {
    // Set the initial client-side timestamp after hydration.
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

  const navigation: { id: View; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "processes", label: "Processes" },
    { id: "sessions", label: "Sessions" },
    { id: "services", label: "Services" },
    { id: "system", label: "System" },
  ];

  const changeView = (nextView: View) => {
    setView(nextView);
    setMenuOpen(false);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ========================================================= */}
      {/* MENU TRIGGER                                              */}
      {/* ========================================================= */}

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

      {/* ========================================================= */}
      {/* BACKDROP                                                  */}
      {/* ========================================================= */}

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

      {/* ========================================================= */}
      {/* SIDE DRAWER                                               */}
      {/* ========================================================= */}

      <aside
        aria-hidden={!menuOpen}
        className="fixed left-0 top-0 z-[9995] h-screen w-[290px] max-w-[85vw] overflow-y-auto rounded-r-[24px] border-r border-zinc-800 bg-zinc-900 shadow-[20px_0_60px_rgba(0,0,0,0.50)]"
        style={{
          transform: menuOpen ? "translateX(0)" : "translateX(-105%)",
          transition: "transform 220ms ease",
        }}
      >
        {/* DRAWER HEADER */}

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

        {/* NAVIGATION PILLS */}

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

      {/* ========================================================= */}
      {/* MAIN CONTENT                                              */}
      {/* ========================================================= */}

      <div className="mx-auto min-h-screen w-full max-w-7xl px-5 pb-10 pt-24 sm:px-8 sm:pt-28">
        {/* HEADER */}

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

        {/* ======================================================= */}
        {/* DASHBOARD                                               */}
        {/* ======================================================= */}

        {view === "dashboard" && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {/* USERS */}

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-sm text-zinc-500">Users</p>

                <p className="mt-3 text-3xl font-semibold">{snapshot.Users.length}</p>
              </div>

              {/* SESSIONS */}

              <button
                type="button"
                onClick={() => changeView("sessions")}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-800/80 active:scale-[0.99]"
                style={{
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation",
                }}
              >
                <p className="text-sm text-zinc-500">Sessions</p>
                <p className="mt-3 text-3xl font-semibold">{snapshot.Sessions.length}</p>
                <p className="mt-2 text-xs text-zinc-600">View sessions →</p>
              </button>

              {/* PROCESSES */}

              <button
                type="button"
                onClick={() => changeView("processes")}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-800/80 active:scale-[0.99]"
                style={{
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation",
                }}
              >
                <p className="text-sm text-zinc-500">Processes</p>

                <p className="mt-3 text-3xl font-semibold">{snapshot.Processes.length}</p>

                <p className="mt-2 text-xs text-zinc-600">View processes →</p>
              </button>

              {/* SERVICES */}

              <button
                type="button"
                onClick={() => changeView("services")}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-800/80 active:scale-[0.99]"
                style={{
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation",
                }}
              >
                <p className="text-sm text-zinc-500">Services</p>

                <p className="mt-3 text-3xl font-semibold">{snapshot.Services.length}</p>

                <p className="mt-2 text-xs text-zinc-600">View services →</p>
              </button>
            </section>

            {/* SYSTEM SUMMARY */}

            <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-lg font-semibold">System</h2>

              <p className="mt-1 text-sm text-zinc-500">Server information</p>

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

        {/* ======================================================= */}
        {/* PROCESSES                                               */}
        {/* ======================================================= */}

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

        {/* ======================================================= */}
        {/* TMUX SESSIONS                                           */}
        {/* ======================================================= */}

        {view === "sessions" && (
          <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            <div className="border-b border-zinc-800 p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Tmux Sessions</h2>

              <p className="mt-1 text-sm text-zinc-500">
                {snapshot.Sessions.length} tmux{" "}
                {snapshot.Sessions.length === 1 ? "session" : "sessions"}
              </p>
            </div>

            {snapshot.Sessions.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-zinc-400">No tmux sessions found.</p>

                <p className="mt-2 text-xs text-zinc-600">
                  Create a tmux session on the server and refresh the panel.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {snapshot.Sessions.map((session) => (
                  <button
                    key={session.name}
                    type="button"
                    className="block w-full p-5 text-left transition hover:bg-zinc-800/40 active:bg-zinc-800/60"
                    style={{
                      WebkitTapHighlightColor: "transparent",
                      touchAction: "manipulation",
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              session.attached ? "bg-green-400" : "bg-zinc-600"
                            }`}
                          />

                          <p className="truncate font-mono text-sm font-medium text-zinc-200">
                            {session.name}
                          </p>
                        </div>

                        <p className="mt-2 text-xs text-zinc-500">
                          {session.windows} {session.windows === 1 ? "window" : "windows"}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs ${
                            session.attached
                              ? "bg-green-400/10 text-green-400"
                              : "bg-zinc-800 text-zinc-500"
                          }`}
                        >
                          {session.attached ? "Attached" : "Detached"}
                        </span>

                        <span className="text-zinc-600">→</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ======================================================= */}
        {/* SERVICES                                                */}
        {/* ======================================================= */}

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

        {/* ======================================================= */}
        {/* SYSTEM                                                  */}
        {/* ======================================================= */}

        {view === "system" && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8">
            <h2 className="text-lg font-semibold">System</h2>

            <p className="mt-1 text-sm text-zinc-500">Detailed server information</p>

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
