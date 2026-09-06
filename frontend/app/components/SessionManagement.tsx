"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

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

type SessionFilter = "all" | "attached" | "detached";

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

function SearchIcon() {
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
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 5 5" />
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
      <path d="m6 6 12 12M18 6 6 18" />
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

function ChevronDownIcon() {
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
      <path d="m6 9 6 6 6-6" />
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

function SearchField({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
        <SearchIcon />
      </div>

      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search sessions…"
        aria-label="Search tmux sessions"
        className="h-10 w-full rounded-full border border-zinc-800 bg-zinc-950 pl-10 pr-10 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 transition focus:border-zinc-600 focus:bg-zinc-950"
      />

      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear session search"
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
        >
          <XIcon />
        </button>
      )}
    </div>
  );
}

function FilterButton({
  active,
  children,
  count,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-xs font-medium transition ${
        active
          ? "bg-zinc-100 text-zinc-900"
          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
      }`}
    >
      <span>{children}</span>

      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] ${
          active ? "bg-zinc-900/10 text-zinc-700" : "bg-zinc-950/70 text-zinc-500"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

export default function SessionManagement({ onOpenTerminal }: SessionManagementProps) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  /*
   * Search / filter state.
   *
   * These are intentionally client-side. The backend still owns
   * the actual tmux operations, while the UI simply filters the
   * session list already returned by the authenticated API.
   */
  const [searchQuery, setSearchQuery] = useState("");
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");

  /*
   * Selection UI state.
   *
   * selectionMode:
   *   The user pressed the top-level Select button.
   *
   * selectionArmed:
   *   The user pressed Select all and individual checkboxes are
   *   therefore visible.
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
   * Filtered session list.
   *
   * Search is case-insensitive and works against the tmux session
   * name. Status filtering is applied after the search.
   */
  const filteredSessions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return sessions.filter((session) => {
      const matchesSearch =
        normalizedQuery.length === 0 || session.name.toLowerCase().includes(normalizedQuery);

      if (!matchesSearch) {
        return false;
      }

      if (sessionFilter === "attached") {
        return session.attached;
      }

      if (sessionFilter === "detached") {
        return !session.attached;
      }

      return true;
    });
  }, [sessions, searchQuery, sessionFilter]);

  const attachedCount = useMemo(
    () => sessions.filter((session) => session.attached).length,
    [sessions],
  );

  const detachedCount = sessions.length - attachedCount;

  const hasActiveSearchOrFilter = searchQuery.trim().length > 0 || sessionFilter !== "all";

  /*
   * Only sessions currently visible through search/filter are affected
   * by "Select all".
   *
   * Existing selections outside the current filter remain intact.
   */
  const visibleSessionNames = useMemo(
    () => filteredSessions.map((session) => session.name),
    [filteredSessions],
  );

  const visibleSelectedCount = useMemo(() => {
    let count = 0;

    for (const name of visibleSessionNames) {
      if (selectedSessions.has(name)) {
        count += 1;
      }
    }

    return count;
  }, [visibleSessionNames, selectedSessions]);

  const allVisibleSelected =
    filteredSessions.length > 0 && visibleSelectedCount === filteredSessions.length;

  const someVisibleSelected =
    visibleSelectedCount > 0 && visibleSelectedCount < filteredSessions.length;

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
   * Select all currently visible sessions.
   */
  const selectAllSessions = () => {
    setSelectionArmed(true);

    setSelectedSessions((previous) => {
      const next = new Set(previous);

      for (const name of visibleSessionNames) {
        next.add(name);
      }

      return next;
    });
  };

  /*
   * If everything currently visible is already selected, clicking
   * Select all again clears the visible selections.
   */
  const toggleSelectAllVisible = () => {
    setSelectionArmed(true);

    setSelectedSessions((previous) => {
      const next = new Set(previous);

      if (allVisibleSelected) {
        for (const name of visibleSessionNames) {
          next.delete(name);
        }
      } else {
        for (const name of visibleSessionNames) {
          next.add(name);
        }
      }

      return next;
    });
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

  /*
   * Clear the currently visible selections.
   *
   * This is intentionally different from exiting selection mode:
   * the user can clear their current selection and immediately
   * select another set.
   */
  const clearVisibleSelection = () => {
    setSelectedSessions((previous) => {
      const next = new Set(previous);

      for (const name of visibleSessionNames) {
        next.delete(name);
      }

      return next;
    });

    setBulkDeleteOpen(false);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectionArmed(false);
    setSelectedSessions(new Set());
    setBulkDeleteOpen(false);
  };

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

  const clearSearchAndFilter = () => {
    setSearchQuery("");
    setSessionFilter("all");
  };

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 p-5 sm:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">Tmux Sessions</h2>

                  {hasActiveSearchOrFilter && (
                    <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-500">
                      {filteredSessions.length} shown
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-zinc-500">
                  {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectionMode}
                  disabled={loading || refreshing || sessions.length === 0 || bulkDeleting}
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

                  <span className="hidden sm:inline">{refreshing ? "Refreshing" : "Refresh"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewSessionOpen(true)}
                  className="flex h-10 items-center gap-2 rounded-full bg-zinc-100 px-4 text-xs font-semibold text-zinc-900 transition hover:bg-white active:scale-[0.98]"
                >
                  <PlusIcon />
                  <span>New session</span>
                </button>
              </div>
            </div>

            {sessions.length > 0 && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <SearchField
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onClear={() => setSearchQuery("")}
                />

                <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                  <FilterButton
                    active={sessionFilter === "all"}
                    count={sessions.length}
                    onClick={() => setSessionFilter("all")}
                  >
                    All
                  </FilterButton>

                  <FilterButton
                    active={sessionFilter === "attached"}
                    count={attachedCount}
                    onClick={() => setSessionFilter("attached")}
                  >
                    Attached
                  </FilterButton>

                  <FilterButton
                    active={sessionFilter === "detached"}
                    count={detachedCount}
                    onClick={() => setSessionFilter("detached")}
                  >
                    Detached
                  </FilterButton>
                </div>
              </div>
            )}

            {hasActiveSearchOrFilter && sessions.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <p className="text-zinc-600">
                  Showing {filteredSessions.length} of {sessions.length}{" "}
                  {sessions.length === 1 ? "session" : "sessions"}
                </p>

                <button
                  type="button"
                  onClick={clearSearchAndFilter}
                  className="rounded-full px-3 py-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
                >
                  Clear filters
                </button>
              </div>
            )}

            {selectionMode && sessions.length > 0 && (
              <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={toggleSelectAllVisible}
                    disabled={bulkDeleting || filteredSessions.length === 0}
                    className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition ${
                      allVisibleSelected
                        ? "text-zinc-100"
                        : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                        allVisibleSelected
                          ? "border-zinc-100 bg-zinc-100 text-zinc-900"
                          : "border-zinc-600 bg-zinc-900"
                      }`}
                    >
                      {allVisibleSelected && <CheckIcon />}
                    </span>

                    <span>
                      {allVisibleSelected
                        ? "All visible selected"
                        : someVisibleSelected
                          ? `${visibleSelectedCount} visible selected`
                          : hasActiveSearchOrFilter
                            ? "Select all visible"
                            : "Select all"}
                    </span>
                  </button>

                  {selectedSessions.size > 0 && (
                    <span className="rounded-full bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400">
                      {selectedSessions.size} selected
                    </span>
                  )}
                </div>

                {selectionArmed && selectedSessions.size > 0 && (
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-800 pt-3">
                    <button
                      type="button"
                      onClick={clearVisibleSelection}
                      disabled={bulkDeleting}
                      className="rounded-full bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
                    >
                      Clear visible
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
          <div className="flex items-start justify-between gap-4 border-b border-zinc-800 bg-red-400/5 px-5 py-4 text-sm text-red-400">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              className="shrink-0 rounded-full p-1 text-red-400/70 transition hover:bg-red-400/10 hover:text-red-300"
              aria-label="Dismiss error"
            >
              <XIcon />
            </button>
          </div>
        )}

        {loading ? (
          <div className="p-10 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950">
              <RefreshIcon />
            </div>

            <p className="mt-4 text-sm text-zinc-500">Loading tmux sessions…</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-500">
              <TerminalIcon />
            </div>

            <p className="mt-5 text-sm font-medium text-zinc-300">No tmux sessions found.</p>

            <p className="mt-2 text-xs text-zinc-600">Create a session to get started.</p>

            <button
              type="button"
              onClick={() => setNewSessionOpen(true)}
              className="mt-5 rounded-full bg-zinc-100 px-5 py-2.5 text-xs font-semibold text-zinc-900 transition hover:bg-white"
            >
              Create session
            </button>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-500">
              <SearchIcon />
            </div>

            <p className="mt-5 text-sm font-medium text-zinc-300">No matching sessions.</p>

            <p className="mt-2 text-xs leading-5 text-zinc-600">
              {searchQuery.trim()
                ? `Nothing matches "${searchQuery.trim()}".`
                : sessionFilter === "attached"
                  ? "There are no attached tmux sessions."
                  : "There are no detached tmux sessions."}
            </p>

            <button
              type="button"
              onClick={clearSearchAndFilter}
              className="mt-5 rounded-full bg-zinc-800 px-5 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {filteredSessions.map((session) => {
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
