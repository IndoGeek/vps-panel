"use client";

import "@xterm/xterm/css/xterm.css";

import { useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { getMe } from "@/lib/api";

function getWebSocketUrl(session: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

  return `${protocol}//${window.location.host}/api/v1/tmux/connect?name=${encodeURIComponent(
    session,
  )}`;
}

type Modifier = "ctrl" | "alt" | "shift" | null;

function applyModifier(data: string, modifier: Modifier): string {
  if (!modifier || data.length === 0) {
    return data;
  }

  const first = data[0];

  if (modifier === "ctrl") {
    const upper = first.toUpperCase();

    if (upper >= "A" && upper <= "Z") {
      return String.fromCharCode(upper.charCodeAt(0) - 64) + data.slice(1);
    }

    if (first === " ") {
      return "\x00" + data.slice(1);
    }

    if (first === "[") {
      return "\x1b" + data.slice(1);
    }

    if (first === "\\") {
      return "\x1c" + data.slice(1);
    }

    if (first === "]") {
      return "\x1d" + data.slice(1);
    }

    if (first === "^") {
      return "\x1e" + data.slice(1);
    }

    if (first === "_") {
      return "\x1f" + data.slice(1);
    }

    return data;
  }

  if (modifier === "alt") {
    return `\x1b${data}`;
  }

  if (modifier === "shift") {
    return first.toUpperCase() + data.slice(1);
  }

  return data;
}

export default function TerminalPage() {
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);

  const terminalRef = useRef<Terminal | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const modifierRef = useRef<Modifier>(null);

  const [sessionName, setSessionName] = useState("");
  const [status, setStatus] = useState("Connecting...");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  const [modifier, setModifier] = useState<Modifier>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get("session");

    if (!session) {
      window.location.href = "/";
      return;
    }

    setSessionName(session);

    let terminal: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let socket: WebSocket | null = null;

    let disposed = false;
    let cleanupResize: (() => void) | undefined;

    const sendResize = () => {
      if (!socket || socket.readyState !== WebSocket.OPEN || !terminal) {
        return;
      }

      socket.send(
        JSON.stringify({
          type: "resize",
          cols: terminal.cols,
          rows: terminal.rows,
        }),
      );
    };

    const connect = async () => {
      try {
        const me = await getMe();

        if (!me.authenticated) {
          window.location.href = "/";
          return;
        }

        if (disposed) {
          return;
        }

        setAuthenticated(true);

        if (!terminalContainerRef.current) {
          return;
        }

        terminal = new Terminal({
          cursorBlink: true,
          convertEol: false,
          fontFamily:
            "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 14,
          scrollback: 5000,
          allowProposedApi: true,
          theme: {
            background: "#09090b",
            foreground: "#f4f4f5",
            cursor: "#f4f4f5",
            selectionBackground: "#3f3f46",
          },
        });

        terminalRef.current = terminal;

        fitAddon = new FitAddon();

        terminal.loadAddon(fitAddon);

        terminal.open(terminalContainerRef.current);

        fitAddon.fit();

        const websocketUrl = getWebSocketUrl(session);

        socket = new WebSocket(websocketUrl);

        socketRef.current = socket;

        socket.binaryType = "arraybuffer";

        socket.onopen = () => {
          if (disposed) {
            return;
          }

          setStatus("Connected");

          fitAddon?.fit();

          sendResize();

          terminal?.focus();
        };

        socket.onmessage = (event) => {
          if (!terminal) {
            return;
          }

          if (typeof event.data === "string") {
            terminal.write(event.data);
            return;
          }

          if (event.data instanceof ArrayBuffer) {
            terminal.write(new Uint8Array(event.data));
            return;
          }

          if (event.data instanceof Blob) {
            event.data
              .arrayBuffer()
              .then((buffer) => {
                if (!disposed) {
                  terminal?.write(new Uint8Array(buffer));
                }
              })
              .catch((error) => {
                console.error("Failed to read terminal data:", error);
              });
          }
        };

        socket.onerror = (event) => {
          console.error("Terminal WebSocket error:", event);

          if (disposed) {
            return;
          }

          setStatus("Connection error");

          terminal?.write("\r\n\x1b[31mWebSocket connection error.\x1b[0m\r\n");
        };

        socket.onclose = (event) => {
          if (disposed) {
            return;
          }

          console.error("Terminal WebSocket closed:", {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });

          setStatus("Disconnected");

          terminal?.write(
            `\r\n\x1b[33mTerminal connection closed ` +
              `(code ${event.code}${event.reason ? `: ${event.reason}` : ""}).\x1b[0m\r\n`,
          );
        };

        terminal.onData((data) => {
          if (!socket || socket.readyState !== WebSocket.OPEN) {
            return;
          }

          const activeModifier = modifierRef.current;

          const output = applyModifier(data, activeModifier);

          socket.send(output);

          if (activeModifier !== null) {
            modifierRef.current = null;
            setModifier(null);
          }
        });

        const handleResize = () => {
          fitAddon?.fit();

          sendResize();
        };

        window.addEventListener("resize", handleResize);

        cleanupResize = () => {
          window.removeEventListener("resize", handleResize);
        };
      } catch (error) {
        console.error("Failed to initialize terminal:", error);

        if (!disposed) {
          setStatus("Failed to connect");
        }
      }
    };

    void connect();

    return () => {
      disposed = true;

      cleanupResize?.();

      socket?.close();

      terminal?.dispose();

      fitAddon?.dispose();

      socketRef.current = null;
      terminalRef.current = null;
    };
  }, []);

  const toggleModifier = (nextModifier: Modifier) => {
    if (modifierRef.current === nextModifier) {
      modifierRef.current = null;
      setModifier(null);
      return;
    }

    modifierRef.current = nextModifier;
    setModifier(nextModifier);

    terminalRef.current?.focus();
  };

  const sendSpecialKey = (value: string) => {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(value);

    terminalRef.current?.focus();
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();

      if (!text) {
        terminalRef.current?.focus();
        return;
      }

      const socket = socketRef.current;

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(text);
      }
    } catch (error) {
      console.error("Unable to read clipboard:", error);
    }

    terminalRef.current?.focus();
  };

  if (authenticated === false) {
    return null;
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => {
              window.location.href = "/?view=sessions";
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 transition hover:bg-zinc-700 hover:text-white active:scale-95"
            aria-label="Back to sessions"
          >
            ←
          </button>

          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Terminal</p>

            <p className="truncate font-mono text-sm font-medium text-zinc-200">
              {sessionName || "Tmux session"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span
            className={`h-2 w-2 rounded-full ${
              status === "Connected"
                ? "bg-green-400"
                : status === "Connecting..."
                  ? "bg-yellow-400"
                  : "bg-red-400"
            }`}
          />

          <span>{status}</span>
        </div>
      </header>

      <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <button
          type="button"
          onClick={() => {
            void pasteFromClipboard();
          }}
          className="shrink-0 rounded-full border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 active:scale-95"
        >
          Paste
        </button>

        <button
          type="button"
          onClick={() => toggleModifier("ctrl")}
          className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition active:scale-95 ${
            modifier === "ctrl"
              ? "border-zinc-200 bg-zinc-100 text-zinc-900"
              : "border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
          }`}
          aria-pressed={modifier === "ctrl"}
        >
          Ctrl
        </button>

        <button
          type="button"
          onClick={() => toggleModifier("alt")}
          className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition active:scale-95 ${
            modifier === "alt"
              ? "border-zinc-200 bg-zinc-100 text-zinc-900"
              : "border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
          }`}
          aria-pressed={modifier === "alt"}
        >
          Alt
        </button>

        <button
          type="button"
          onClick={() => toggleModifier("shift")}
          className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition active:scale-95 ${
            modifier === "shift"
              ? "border-zinc-200 bg-zinc-100 text-zinc-900"
              : "border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
          }`}
          aria-pressed={modifier === "shift"}
        >
          Shift
        </button>

        <button
          type="button"
          onClick={() => sendSpecialKey("\t")}
          className="shrink-0 rounded-full border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 active:scale-95"
        >
          Tab
        </button>
      </div>

      <section className="min-h-0 flex-1 p-2 sm:p-3">
        <div
          ref={terminalContainerRef}
          className="h-full w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-2"
          onClick={() => {
            terminalRef.current?.focus();
          }}
        />
      </section>
    </main>
  );
}
