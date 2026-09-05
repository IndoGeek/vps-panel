"use client";

import { useEffect, useState } from "react";
import Dashboard from "./dashboard";
import { getMe, getSnapshot, type UserInfo } from "@/lib/api";

export default function Home() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof getSnapshot>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const me = await getMe();

        if (!me.authenticated) {
          return;
        }

        setUser(me.user);
        setSnapshot(await getSnapshot());
      } catch {
        // Not authenticated.
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          username,
          password,
        }),
      });

      if (!response.ok) {
        throw new Error("Invalid credentials");
      }

      const result = await response.json();

      setUser(result.user);
      setSnapshot(await getSnapshot());
      setPassword("");
    } catch {
      setError("Invalid username or password.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <p className="text-sm text-zinc-500">Loading…</p>
      </main>
    );
  }

  if (!user || !snapshot) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-5 text-zinc-100">
        <form
          onSubmit={login}
          className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
        >
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            VPS Panel
          </p>

          <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>

          <p className="mt-2 text-sm text-zinc-500">
            Authenticate to manage this server.
          </p>

          <div className="mt-6 space-y-4">
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
              autoComplete="username"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-600"
            />

            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-600"
            />
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:opacity-50"
          >
            Sign in
          </button>
        </form>
      </main>
    );
  }

  return <Dashboard initialSnapshot={snapshot} user={user} />;
}
