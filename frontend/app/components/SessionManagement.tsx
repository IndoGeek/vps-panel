"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  createTmuxSession,
  deleteTmuxSession,
  deleteTmuxSessions,
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

function SelectIcon() {
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
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8 12 2.5 2.5L16 9" />
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

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

type MenuPosition = {
  top: number;
  left: number;
};

function SessionMenu({
  session,
  onRename,
  onDetach,
  onDelete,
}: {
  session: SessionInfo;
  onRename: () => void;
  onDetach: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const MENU_WIDTH = 180;
  const MENU_HEIGHT = 150;
  const VIEWPORT_PADDING = 8;
  const MENU_GAP = 8;

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) {
      return;
    }

    const rect = buttonRef.current.getBoundingClientRect();

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = rect.right - MENU_WIDTH;

    if (left < VIEWPORT_PADDING) {
      left = VIEWPORT_PADDING;
    }

    if (left + MENU_WIDTH > viewportWidth - VIEWPORT_PADDING) {
      left = viewportWidth - MENU_WIDTH - VIEWPORT_PADDING;
    }

    let top = rect.bottom + MENU_GAP;

    if (top + MENU_HEIGHT > viewportHeight - VIEWPORT_PADDING) {
      top = rect.top - MENU_HEIGHT - MENU_GAP;
    }

    if (top < VIEWPORT_PADDING) {
      top = VIEWPORT_PADDING;
    }

    setPosition({
      top,
      left,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    updatePosition();

    const handleResize = () => {
      updatePosition();
    };

    const handleScroll = () => {
      updatePosition();
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = () => {
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("click", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Actions for ${session.name}`}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200 active:scale-95"
      >
        <MoreIcon />
      </button>

      {open && position && (
        <div
          className="fixed z-[10010] w-[180px] overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 p-1 shadow-2xl"
          style={{
            top: position.top,
            left: position.left,
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
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
    </>
  );
}

export default function SessionManagement({ onOpenTerminal }: SessionManagementProps) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  /*
   * Selection UI state.
   *
   * selectionMode:
   *   The user pressed the top-level Select button.
   *
   * selectionArmed:
   *   The user pressed Select all.
   *
   * We deliberately keep these separate so that the normal session
   * list remains completely clean until the user explicitly enters
   * bulk-selection mode.
   */
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectionArmed, setSelectionArmed] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(() => new Set());

  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

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

      setSelectedSessions((previous) => {
        const availableNames = new Set(nextSessions.map((session) => session.name));

        const next = new Set<string>();

        for (const name of previous) {
          if (availableNames.has(name)) {
            next.add(name);
          }
        }

        return next;
      });
    } catch (err) {
      console.error("Failed to load tmux sessions:", err);

      if (err instanceof Error && err.message === "UNAUTHORIZED") {
        window.location.reload();
        return;
      }

      setError(err instanceof Error ? err.message : "Unable to load tmux sessions.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  /*
   * Enter/exit bulk-selection mode.
   */
  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectionMode(false);
      setSelectionArmed(false);
      setSelectedSessions(new Set());
      setBulkDeleteOpen(false);
      return;
    }

    setSelectionMode(true);
    setSelectionArmed(false);
    setSelectedSessions(new Set());
  };

  /*
   * "Select all" is the explicit second step.
   *
   * Once pressed, all checkboxes become visible. From there the
   * user can uncheck individual sessions if they only want to
   * delete a subset.
   */
  const selectAllSessions = () => {
    setSelectionArmed(true);
    setSelectedSessions(new Set(sessions.map((session) => session.name)));
  };

  const toggleSessionSelection = (sessionName: string) => {
    if (!selectionArmed) {
      return;
    }

    setSelectedSessions((previous) => {
      const next = new Set(previous);

      if (next.has(sessionName)) {
        next.delete(sessionName);
      } else {
        next.add(sessionName);
      }

      return next;
    });
  };

  const clearSelection = () => {
    setSelectionMode(false);
    setSelectionArmed(false);
    setSelectedSessions(new Set());
    setBulkDeleteOpen(false);
  };

  const allSelected = sessions.length > 0 && selectedSessions.size === sessions.length;

  const someSelected = selectedSessions.size > 0 && selectedSessions.size < sessions.length;

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

      setSelectedSessions((previous) => {
        const next = new Set(previous);

        if (next.delete(renameSession.name)) {
          next.add(name);
        }

        return next;
      });

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

      setSelectedSessions((previous) => {
        const next = new Set(previous);
        next.delete(deletingSession.name);
        return next;
      });

      setDeletingSession(null);

      await loadSessions(true);
    } catch (err) {
      console.error("Failed to delete tmux session:", err);

      setError(err instanceof Error ? err.message : "Unable to delete tmux session.");
    } finally {
      setDeleting(false);
    }
  };

  const submitBulkDelete = async () => {
    const names = Array.from(selectedSessions);

    if (names.length === 0) {
      return;
    }

    try {
      setBulkDeleting(true);
      setError("");

      await deleteTmuxSessions(names);

      setSelectedSessions(new Set());
      setSelectionMode(false);
      setSelectionArmed(false);
      setBulkDeleteOpen(false);

      await loadSessions(true);
    } catch (err) {
      console.error("Failed to delete selected tmux sessions:", err);

      setError(err instanceof Error ? err.message : "Unable to delete selected tmux sessions.");
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 p-5 sm:p-6">
          <div className="flex flex-col gap-4">
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
                  onClick={toggleSelectionMode}
                  disabled={loading || refreshing || sessions.length === 0}
                  aria-pressed={selectionMode}
                  className={`flex h-10 items-center gap-2 rounded-full px-4 text-xs font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
                    selectionMode
                      ? "bg-zinc-100 text-zinc-900 hover:bg-white"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                  }`}
                >
                  <SelectIcon />

                  {selectionMode ? "Cancel" : "Select"}
                </button>

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

            {selectionMode && sessions.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-3">
                <button
                  type="button"
                  onClick={selectAllSessions}
                  disabled={bulkDeleting}
                  className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition ${
                    allSelected
                      ? "text-zinc-100"
                      : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                      allSelected
                        ? "border-zinc-100 bg-zinc-100 text-zinc-900"
                        : "border-zinc-600 bg-zinc-900"
                    }`}
                  >
                    {allSelected && <CheckIcon />}
                  </span>

                  <span>
                    {allSelected
                      ? "All sessions selected"
                      : someSelected
                        ? `${selectedSessions.size} selected`
                        : "Select all"}
                  </span>
                </button>

                {selectionArmed && selectedSessions.size > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={clearSelection}
                      disabled={bulkDeleting}
                      className="rounded-full bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
                    >
                      Clear
                    </button>

                    <button
                      type="button"
                      onClick={() => setBulkDeleteOpen(true)}
                      disabled={bulkDeleting}
                      className="flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <TrashIcon />
                      Delete {selectedSessions.size}
                    </button>
                  </div>
                )}
              </div>
            )}
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
            {sessions.map((session) => {
              const selected = selectedSessions.has(session.name);

              return (
                <div
                  key={session.name}
                  className={`p-4 transition sm:p-5 ${
                    selected ? "bg-zinc-800/40" : "hover:bg-zinc-800/30"
                  }`}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    {selectionArmed && (
                      <label
                        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-zinc-800"
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSessionSelection(session.name)}
                          aria-label={`Select ${session.name}`}
                          className="h-4 w-4 accent-zinc-100"
                        />
                      </label>
                    )}

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
              );
            })}
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

      {bulkDeleteOpen && selectedSessions.size > 0 && (
        <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/70 p-5">
          <div className="w-full max-w-md rounded-2xl border border-red-400/20 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-400/10 text-red-400">
              <TrashIcon />
            </div>

            <h3 className="mt-5 text-lg font-semibold">Delete selected sessions?</h3>

            <p className="mt-2 text-sm leading-6 text-zinc-500">
              You are about to permanently terminate{" "}
              <span className="font-semibold text-zinc-200">{selectedSessions.size}</span> tmux{" "}
              {selectedSessions.size === 1 ? "session" : "sessions"}. All running processes inside
              those sessions will also be terminated.
            </p>

            <div className="mt-4 max-h-32 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <div className="space-y-2">
                {Array.from(selectedSessions).map((name) => (
                  <div key={name} className="truncate font-mono text-xs text-zinc-400">
                    {name}
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-3 text-xs text-red-400">This action cannot be undone.</p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkDeleteOpen(false)}
                disabled={bulkDeleting}
                className="rounded-full bg-zinc-800 px-4 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void submitBulkDelete()}
                disabled={bulkDeleting}
                className="rounded-full bg-red-500 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {bulkDeleting ? "Deleting…" : `Delete ${selectedSessions.size}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
