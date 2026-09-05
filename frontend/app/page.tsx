import { getSnapshot } from "@/lib/api";

export default async function Home() {
  const snapshot = await getSnapshot();

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="text-sm text-zinc-400">VPS Panel</p>
          <h1 className="text-3xl font-semibold tracking-tight">{snapshot.System.hostname}</h1>
          <p className="mt-2 text-zinc-400">
            {snapshot.System.os} · {snapshot.System.architecture}
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">Users</p>
            <p className="mt-2 text-3xl font-semibold">{snapshot.Users.length}</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">Sessions</p>
            <p className="mt-2 text-3xl font-semibold">{snapshot.Sessions.length}</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">Processes</p>
            <p className="mt-2 text-3xl font-semibold">{snapshot.Processes.length}</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">Services</p>
            <p className="mt-2 text-3xl font-semibold">{snapshot.Services.length}</p>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold">System</h2>

          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-zinc-400">Hostname</dt>
              <dd className="mt-1">{snapshot.System.hostname}</dd>
            </div>

            <div>
              <dt className="text-sm text-zinc-400">Operating system</dt>
              <dd className="mt-1">{snapshot.System.os}</dd>
            </div>

            <div>
              <dt className="text-sm text-zinc-400">Architecture</dt>
              <dd className="mt-1">{snapshot.System.architecture}</dd>
            </div>

            <div>
              <dt className="text-sm text-zinc-400">Kernel</dt>
              <dd className="mt-1">{snapshot.System.kernel}</dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}
