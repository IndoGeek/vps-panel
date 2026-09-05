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
      {/* ========================================================= */}
      {/* MENU TRIGGER                                              */}
      {/* ========================================================= */}

      <div
        role="button"
        tabIndex={0}
        aria-label="Open navigation"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setMenuOpen(true);
          }
        }}
        style={{
          position: "fixed",
          top: "18px",
          left: "18px",
          width: "50px",
          height: "50px",
          zIndex: 10000,
          borderRadius: "9999px",
          border: "1px solid rgb(39, 39, 42)",
          background: "rgb(24, 24, 27)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
          }}
        >
          <span
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              background: "#d4d4d8",
            }}
          />
          <span
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              background: "#d4d4d8",
            }}
          />
          <span
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              background: "#d4d4d8",
            }}
          />
        </div>
      </div>

      {/* ========================================================= */}
      {/* BACKDROP                                                  */}
      {/* ========================================================= */}

      <div
        onClick={() => setMenuOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9990,
          background: "rgba(0, 0, 0, 0.60)",
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? "auto" : "none",
          transition: "opacity 180ms ease",
        }}
      />

      {/* ========================================================= */}
      {/* SIDE DRAWER                                               */}
      {/* ========================================================= */}

      <aside
        aria-hidden={!menuOpen}
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          width: "290px",
          maxWidth: "85vw",
          zIndex: 9995,
          padding: "24px 16px",
          background: "rgb(24, 24, 27)",
          borderRight: "1px solid rgb(39, 39, 42)",
          borderRadius: "0 24px 24px 0",
          boxShadow: "20px 0 60px rgba(0, 0, 0, 0.50)",
          transform: menuOpen ? "translateX(0)" : "translateX(-105%)",
          transition: "transform 220ms ease",
          overflowY: "auto",
        }}
      >
        {/* DRAWER HEADER */}

        <div className="mb-8 flex items-center justify-between px-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">VPS Panel</p>

            <p className="mt-1 text-lg font-semibold">{snapshot.System.hostname}</p>
          </div>

          <div
            role="button"
            tabIndex={0}
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setMenuOpen(false);
              }
            }}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "9999px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#a1a1aa",
              fontSize: "24px",
              userSelect: "none",
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
            }}
          >
            ×
          </div>
        </div>

        {/* NAVIGATION PILLS */}

        <nav className="space-y-3">
          {navigation.map((item) => {
            const active = view === item.id;

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => changeView(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    changeView(item.id);
                  }
                }}
                style={{
                  width: "100%",
                  minHeight: "48px",
                  borderRadius: "9999px",
                  display: "flex",
                  alignItems: "center",
                  padding: "0 18px",
                  cursor: "pointer",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation",
                  background: active ? "rgb(244, 244, 245)" : "rgb(39, 39, 42)",
                  color: active ? "rgb(24, 24, 27)" : "rgb(212, 212, 216)",
                  fontSize: "14px",
                  fontWeight: 500,
                  transition: "background 150ms ease, color 150ms ease",
                }}
              >
                {item.label}
              </div>
            );
          })}
        </nav>
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

              <span>{lastUpdated.toLocaleTimeString()}</span>
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

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-sm text-zinc-500">Sessions</p>

                <p className="mt-3 text-3xl font-semibold">{snapshot.Sessions.length}</p>
              </div>

              {/* PROCESSES */}

              <div
                role="button"
                tabIndex={0}
                onClick={() => changeView("processes")}
                className="cursor-pointer rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-800/80"
              >
                <p className="text-sm text-zinc-500">Processes</p>

                <p className="mt-3 text-3xl font-semibold">{snapshot.Processes.length}</p>

                <p className="mt-2 text-xs text-zinc-600">View processes →</p>
              </div>

              {/* SERVICES */}

              <div
                role="button"
                tabIndex={0}
                onClick={() => changeView("services")}
                className="cursor-pointer rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-800/80"
              >
                <p className="text-sm text-zinc-500">Services</p>

                <p className="mt-3 text-3xl font-semibold">{snapshot.Services.length}</p>

                <p className="mt-2 text-xs text-zinc-600">View services →</p>
              </div>
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
