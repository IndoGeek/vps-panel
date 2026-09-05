"use client";

import "@xterm/xterm/css/xterm.css";

import { useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { getMe } from "@/lib/api";

function getWebSocketBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_BACKEND_WS_URL;

  if (configured) {
    return configured;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

  return `${protocol}//${window.location.hostname}:8090`;
}

export default function TerminalPage() {
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);

  const [sessionName, setSessionName] = useState("");
  const [status, setStatus] = useState("Connecting...");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

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

        setAuthenticated(true);

        if (!terminalContainerRef.current || disposed) {
          return;
        }

        terminal = new Terminal({
          cursorBlink: true,
          convertEol: false,
          fontFamily:
            "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 14,
          scrollback: 5000,
          theme: {
            background: "#09090b",
            foreground: "#f4f4f5",
            cursor: "#f4f4f5",
            selectionBackground: "#3f3f46",
          },
        });

        fitAddon = new FitAddon();

        terminal.loadAddon(fitAddon);
        terminal.open(terminalContainerRef.current);

        fitAddon.fit();

        const websocketBase = getWebSocketBaseUrl();

        socket = new WebSocket(
          `${websocketBase}/api/v1/tmux/connect?name=${encodeURIComponent(session)}`,
        );

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
            event.data.arrayBuffer().then((buffer) => {
              if (!disposed) {
                terminal?.write(new Uint8Array(buffer));
              }
            });
          }
        };

        socket.onerror = () => {
          if (!disposed) {
            setStatus("Connection error");
            terminal?.write("\r\n\x1b[31mWebSocket connection error.\x1b[0m\r\n");
          }
        };

        socket.onclose = () => {
          if (!disposed) {
            setStatus("Disconnected");
            terminal?.write("\r\n\x1b[33mTerminal connection closed.\x1b[0m\r\n");
          }
        };

        terminal.onData((data) => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(data);
          }
        });

        const handleResize = () => {
          fitAddon?.fit();
          sendResize();
        };

        window.addEventListener("resize", handleResize);

        return () => {
          window.removeEventListener("resize", handleResize);
        };
      } catch (error) {
        console.error("Failed to initialize terminal:", error);

        if (!disposed) {
          setStatus("Failed to connect");
        }
      }
    };

    let cleanupResize: (() => void) | undefined;

    connect().then((cleanup) => {
      cleanupResize = cleanup;
    });

    return () => {
      disposed = true;

      cleanupResize?.();

      socket?.close();
      terminal?.dispose();
      fitAddon?.dispose();
    };
  }, []);

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
              window.location.href = "/";
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
            aria-label="Back to dashboard"
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

      <section className="min-h-0 flex-1 p-2 sm:p-3">
        <div
          ref={terminalContainerRef}
          className="h-full w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-2"
        />
      </section>
    </main>
  );
}
