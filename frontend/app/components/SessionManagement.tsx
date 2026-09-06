"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createTmuxSession,
  deleteTmuxSession,
  detachTmuxSession,
  getTmuxSessions,
  renameTmuxSession,
  type SessionInfo,
} from "@/lib/api";

type SessionManagementProps = {
  onOpenTerminal: (sessionName: string) => void;
};

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
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
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 11a8.1 8.1 0 0 0-14.7-4.7L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8.1 8.1 0 0 0 14.7 4.7L20 16" />
      <path d="M20 20v-4h-4" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

function TerminalIcon() {
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
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m7 9 3 3-3 3M13 15h4" />
    </svg>
  );
}

function PencilIcon() {
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
      <path d="m4 20 4.2-1 9.9-9.9a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" />
      <path d="m13.8 7.2 3 3" />
    </svg>
  );
}

function DetachIcon() {
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
      <path d="M8 7H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3" />
      <path d="M10 3h9v9" />
      <path d="m19 3-9 9" />
    </svg>
  );
}

function TrashIcon() {
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
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}

function SessionMenu({
  session,
  onOpen,
  onRename,
  onDetach,
  onDelete,
}: {
  session: SessionInfo;
  onOpen: () => void;
  onRename: () => void;
  onDetach: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const close = () => setOpen(false);

    window.addEventListener("click", close);

    return () => {
      window.removeEventListener("click", close);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Actions for ${session.name}`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200 active:scale-95"
      >
        <MoreIcon />
      </button>

      {open && (
        <div
          className="absolute right-0 top-11 z-50 min-w-[170px] overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 p-1 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpen();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
          >
            <TerminalIcon />
            Open terminal
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onRename();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
          >
            <PencilIcon />
            Rename
          </button>

          <button
            type="button"
            disabled={!session.attached}
            onClick={() => {
              if (!session.attached) {
                return;
              }

              setOpen(false);
              onDetach();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <DetachIcon />
            Detach
          </button>

          <div className="my-1 border-t border-zinc-800" />

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-red-400 transition hover:bg-red-400/10"
          >
            <TrashIcon />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function SessionManagement({ onOpenTerminal }: SessionManagementProps) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [creating, setCreating] = useState(false);

  const [renameSession, setRenameSession] = useState<SessionInfo | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const [deletingSession, setDeletingSession] = useState<SessionInfo | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [detachingSession, setDetachingSession] = useState<SessionInfo | null>(null);
  const [detaching, setDetaching] = useState(false);

  const loadSessions = useCallback(async (showRefreshState = false) => {
    try {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const nextSessions = await getTmuxSessions();

      setSessions(nextSessions);
    } catch (err) {
      console.error("Failed to load tmux sessions:", err);

      if (err instanceof Error && err.message === "UNAUTHORIZED") {
        window.location.reload();
        return;
      }

      setError("Unable to load tmux sessions.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const submitCreate = async () => {
    const name = newSessionName.trim();

    if (!name) {
      return;
    }

    try {
      setCreating(true);
      setError("");

      await createTmuxSession(name);

      setNewSessionName("");
      setNewSessionOpen(false);

      await loadSessions(true);
    } catch (err) {
      console.error("Failed to create tmux session:", err);

      setError(err instanceof Error ? err.message : "Unable to create tmux session.");
    } finally {
      setCreating(false);
    }
  };

  const submitRename = async () => {
    if (!renameSession) {
      return;
    }

    const name = renameValue.trim();

    if (!name) {
      return;
    }

    try {
      setRenaming(true);
      setError("");

      await renameTmuxSession(renameSession.name, name);

      setRenameSession(null);
      setRenameValue("");

      await loadSessions(true);
    } catch (err) {
      console.error("Failed to rename tmux session:", err);

      setError(err instanceof Error ? err.message : "Unable to rename tmux session.");
    } finally {
      setRenaming(false);
    }
  };

  const submitDetach = async () => {
    if (!detachingSession) {
      return;
    }

    try {
      setDetaching(true);
      setError("");

      await detachTmuxSession(detachingSession.name);

      setDetachingSession(null);

      await loadSessions(true);
    } catch (err) {
      console.error("Failed to detach tmux session:", err);

      setError(err instanceof Error ? err.message : "Unable to detach tmux session.");
    } finally {
      setDetaching(false);
    }
  };

  const submitDelete = async () => {
    if (!deletingSession) {
      return;
    }

    try {
      setDeleting(true);
      setError("");

      await deleteTmuxSession(deletingSession.name);

      setDeletingSession(null);

      await loadSessions(true);
    } catch (err) {
      console.error("Failed to delete tmux session:", err);

      setError(err instanceof Error ? err.message : "Unable to delete tmux session.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Tmux Sessions</h2>

              <p className="mt-1 text-sm text-zinc-500">
                {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadSessions(true)}
                disabled={refreshing || loading}
                className="flex h-10 items-center gap-2 rounded-full bg-zinc-800 px-4 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RefreshIcon />

                {refreshing ? "Refreshing" : "Refresh"}
              </button>

              <button
                type="button"
                onClick={() => setNewSessionOpen(true)}
                className="flex h-10 items-center gap-2 rounded-full bg-zinc-100 px-4 text-xs font-semibold text-zinc-900 transition hover:bg-white active:scale-[0.98]"
              >
                <PlusIcon />
                New session
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="border-b border-zinc-800 bg-red-400/5 px-5 py-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center">
            <p className="text-sm text-zinc-500">Loading tmux sessions…</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-zinc-400">No tmux sessions found.</p>

            <p className="mt-2 text-xs text-zinc-600">Create a session to get started.</p>

            <button
              type="button"
              onClick={() => setNewSessionOpen(true)}
              className="mt-5 rounded-full bg-zinc-100 px-5 py-2.5 text-xs font-semibold text-zinc-900 transition hover:bg-white"
            >
              Create session
            </button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {sessions.map((session) => (
              <div key={session.name} className="p-4 transition hover:bg-zinc-800/30 sm:p-5">
                <div className="flex items-center gap-3 sm:gap-4">
                  <button
                    type="button"
                    onClick={() => onOpenTerminal(session.name)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          session.attached ? "bg-green-400" : "bg-zinc-600"
                        }`}
                      />

                      <p className="truncate font-mono text-sm font-medium text-zinc-200">
                        {session.name}
                      </p>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-500">
                        {session.windows} {session.windows === 1 ? "window" : "windows"}
                      </span>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs ${
                          session.attached
                            ? "bg-green-400/10 text-green-400"
                            : "bg-zinc-800 text-zinc-500"
                        }`}
                      >
                        {session.attached ? "Attached" : "Detached"}
                      </span>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenTerminal(session.name)}
                      className="hidden h-9 items-center gap-2 rounded-full bg-zinc-800 px-3 text-xs text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-100 sm:flex"
                    >
                      <TerminalIcon />
                      Open
                    </button>

                    {session.attached && (
                      <button
                        type="button"
                        onClick={() => setDetachingSession(session)}
                        className="hidden h-9 items-center gap-2 rounded-full bg-zinc-800 px-3 text-xs text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-100 sm:flex"
                      >
                        <DetachIcon />
                        Detach
                      </button>
                    )}

                    <SessionMenu
                      session={session}
                      onOpen={() => onOpenTerminal(session.name)}
                      onRename={() => {
                        setRenameSession(session);
                        setRenameValue(session.name);
                      }}
                      onDetach={() => setDetachingSession(session)}
                      onDelete={() => setDeletingSession(session)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {newSessionOpen && (
        <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/70 p-5">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Create tmux session</h3>

            <p className="mt-2 text-sm text-zinc-500">Enter the name for the new tmux session.</p>

            <input
              autoFocus
              value={newSessionName}
              onChange={(event) => setNewSessionName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void submitCreate();
                }

                if (event.key === "Escape") {
                  setNewSessionOpen(false);
                  setNewSessionName("");
                }
              }}
              placeholder="my-session"
              className="mt-5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-zinc-500"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewSessionOpen(false);
                  setNewSessionName("");
                }}
                disabled={creating}
                className="rounded-full bg-zinc-800 px-4 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void submitCreate()}
                disabled={creating || !newSessionName.trim()}
                className="rounded-full bg-zinc-100 px-5 py-2.5 text-xs font-semibold text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {creating ? "Creating…" : "Create session"}
              </button>
            </div>
          </div>
        </div>
      )}

      {renameSession && (
        <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/70 p-5">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Rename session</h3>

            <p className="mt-2 text-sm text-zinc-500">
              Rename <span className="font-mono text-zinc-300">{renameSession.name}</span>.
            </p>

            <input
              autoFocus
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void submitRename();
                }

                if (event.key === "Escape") {
                  setRenameSession(null);
                  setRenameValue("");
                }
              }}
              className="mt-5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-mono text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRenameSession(null);
                  setRenameValue("");
                }}
                disabled={renaming}
                className="rounded-full bg-zinc-800 px-4 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void submitRename()}
                disabled={renaming || !renameValue.trim()}
                className="rounded-full bg-zinc-100 px-5 py-2.5 text-xs font-semibold text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {renaming ? "Renaming…" : "Rename"}
              </button>
            </div>
          </div>
        </div>
      )}

      {detachingSession && (
        <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/70 p-5">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Detach session</h3>

            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Detach <span className="font-mono text-zinc-300">{detachingSession.name}</span>? The
              tmux session itself will keep running.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDetachingSession(null)}
                disabled={detaching}
                className="rounded-full bg-zinc-800 px-4 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void submitDetach()}
                disabled={detaching}
                className="rounded-full bg-zinc-100 px-5 py-2.5 text-xs font-semibold text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {detaching ? "Detaching…" : "Detach"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingSession && (
        <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/70 p-5">
          <div className="w-full max-w-md rounded-2xl border border-red-400/20 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-400/10 text-red-400">
              <TrashIcon />
            </div>

            <h3 className="mt-5 text-lg font-semibold">Delete session?</h3>

            <p className="mt-2 text-sm leading-6 text-zinc-500">
              This will permanently terminate the tmux session{" "}
              <span className="font-mono text-zinc-300">{deletingSession.name}</span> and all of its
              running processes.
            </p>

            <p className="mt-3 text-xs text-red-400">This action cannot be undone.</p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingSession(null)}
                disabled={deleting}
                className="rounded-full bg-zinc-800 px-4 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void submitDelete()}
                disabled={deleting}
                className="rounded-full bg-red-500 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Delete session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
