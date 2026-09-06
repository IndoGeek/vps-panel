import { createServer } from "node:http";
import { parse } from "node:url";

import next from "next";
import WebSocket, { WebSocketServer } from "ws";

const dev = process.env.NODE_ENV !== "production";

const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

/*
 * The VPS agent currently listens on 127.0.0.1:8091.
 *
 * The browser must NOT connect directly to the backend
 * WebSocket endpoint.
 *
 * Browser:
 *
 *   /terminal-ws
 *
 * Frontend proxy:
 *
 *   /terminal-ws
 *        ↓
 *   ws://127.0.0.1:8091/api/v1/tmux/connect
 *
 * BACKEND_WS_URL can override the backend address if required.
 */
const backendWsUrl = process.env.BACKEND_WS_URL || "ws://127.0.0.1:8091";

const app = next({
  dev,
  hostname,
  port,
});

const handle = app.getRequestHandler();

await app.prepare();

const server = createServer(async (req, res) => {
  try {
    const parsedUrl = parse(req.url, true);

    await handle(req, res, parsedUrl);
  } catch (error) {
    console.error("Next.js request error:", error);

    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Internal server error");
    }
  }
});

const websocketServer = new WebSocketServer({
  noServer: true,

  /*
   * Do not use compression for the terminal.
   *
   * This keeps terminal frames simple and avoids unnecessary
   * extension negotiation on mobile browsers.
   */
  perMessageDeflate: false,
});

server.on("upgrade", (request, socket, head) => {
  let requestUrl;

  try {
    requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  } catch (error) {
    console.error("Invalid WebSocket URL:", error);

    socket.destroy();

    return;
  }

  /*
   * IMPORTANT:
   *
   * The browser uses /terminal-ws.
   *
   * This is intentionally NOT:
   *
   *   /api/v1/tmux/connect
   *
   * That path belongs to the application/backend API.
   */
  if (requestUrl.pathname !== "/terminal-ws") {
    return;
  }

  console.log("Terminal browser WebSocket upgrade:", requestUrl.pathname + requestUrl.search);

  /*
   * Connect to the Go backend first.
   */
  const backendUrl = new URL(backendWsUrl);

  backendUrl.pathname = "/api/v1/tmux/connect";
  backendUrl.search = requestUrl.search;

  const headers = {};

  /*
   * Forward the browser cookies to the backend.
   *
   * This keeps authentication available to the backend.
   */
  if (request.headers.cookie) {
    headers.cookie = request.headers.cookie;
  }

  console.log("Connecting terminal proxy to backend:", backendUrl.toString());

  const backendSocket = new WebSocket(backendUrl.toString(), {
    headers,
    perMessageDeflate: false,
  });

  let backendOpened = false;
  let upgradeFinished = false;
  let browserSocket = null;
  let closed = false;

  const destroyRawSocket = () => {
    try {
      socket.destroy();
    } catch {}
  };

  const closeBackend = (code = 1000, reason = "proxy closed") => {
    if (
      backendSocket.readyState === WebSocket.OPEN ||
      backendSocket.readyState === WebSocket.CONNECTING
    ) {
      try {
        backendSocket.close(code, reason.slice(0, 120));
      } catch {}
    }
  };

  /*
   * Backend WebSocket error.
   */
  backendSocket.on("error", (error) => {
    console.error("Terminal backend WebSocket error:", error);

    if (!upgradeFinished) {
      destroyRawSocket();

      return;
    }

    if (browserSocket) {
      try {
        browserSocket.close(1011, "backend websocket error");
      } catch {}
    }
  });

  /*
   * Backend WebSocket closed.
   */
  backendSocket.on("close", (code, reason) => {
    console.log(
      "Terminal backend WebSocket closed:",
      `code=${code}`,
      `reason=${reason?.toString() || "<none>"}`,
    );

    if (!upgradeFinished) {
      destroyRawSocket();

      return;
    }

    if (!closed && browserSocket) {
      closed = true;

      try {
        browserSocket.close(code === 1000 ? 1000 : 1011, "backend disconnected");
      } catch {}
    }
  });

  /*
   * Backend connection succeeded.
   *
   * NOW accept the browser WebSocket.
   *
   * This is the important part of the working
   * beb795d implementation.
   */
  backendSocket.on("open", () => {
    backendOpened = true;

    console.log(
      "Terminal WebSocket connected to backend:",
      backendUrl.pathname + backendUrl.search,
    );

    websocketServer.handleUpgrade(request, socket, head, (newBrowserSocket) => {
      browserSocket = newBrowserSocket;
      upgradeFinished = true;

      websocketServer.emit("connection", browserSocket, request);

      console.log("Terminal browser WebSocket accepted:", request.url);

      /*
       * Browser -> backend
       */
      browserSocket.on("message", (data, isBinary) => {
        if (backendSocket.readyState !== WebSocket.OPEN) {
          console.warn("Browser message received while backend is not open");

          return;
        }

        try {
          backendSocket.send(data, {
            binary: isBinary,
          });
        } catch (error) {
          console.error("Browser -> backend terminal send failed:", error);

          closeBackend(1011, "browser to backend send failed");

          try {
            browserSocket.close(1011, "terminal proxy error");
          } catch {}
        }
      });

      /*
       * Backend -> browser
       */
      backendSocket.on("message", (data, isBinary) => {
        if (!browserSocket || browserSocket.readyState !== WebSocket.OPEN) {
          return;
        }

        try {
          browserSocket.send(data, {
            binary: isBinary,
          });
        } catch (error) {
          console.error("Backend -> browser terminal send failed:", error);

          try {
            browserSocket.close(1011, "terminal proxy error");
          } catch {}
        }
      });

      /*
       * Browser closed.
       */
      browserSocket.on("close", (code, reason) => {
        console.log(
          "Terminal browser WebSocket closed:",
          `code=${code}`,
          `reason=${reason?.toString() || "<none>"}`,
        );

        if (closed) {
          return;
        }

        closed = true;

        closeBackend(code, reason?.toString() || "browser disconnected");
      });

      /*
       * Browser error.
       */
      browserSocket.on("error", (error) => {
        console.error("Terminal browser WebSocket error:", error);

        if (closed) {
          return;
        }

        closed = true;

        closeBackend(1011, "browser websocket error");
      });

      /*
       * Backend heartbeat.
       */
      const heartbeat = setInterval(() => {
        if (closed) {
          clearInterval(heartbeat);

          return;
        }

        if (backendSocket.readyState === WebSocket.OPEN) {
          try {
            backendSocket.ping();
          } catch (error) {
            console.error("Backend terminal ping failed:", error);

            clearInterval(heartbeat);

            try {
              browserSocket.close(1011, "backend ping failed");
            } catch {}

            closeBackend(1011, "backend ping failed");
          }
        }
      }, 30000);

      browserSocket.once("close", () => {
        clearInterval(heartbeat);
      });

      backendSocket.once("close", () => {
        clearInterval(heartbeat);
      });
    });
  });

  /*
   * Do not leave the HTTP upgrade hanging forever
   * if the backend cannot connect.
   */
  const upgradeTimeout = setTimeout(() => {
    if (!backendOpened && !upgradeFinished) {
      console.error("Terminal backend WebSocket connection timeout:", backendUrl.toString());

      closeBackend(1013, "backend connection timeout");

      destroyRawSocket();
    }
  }, 10000);

  backendSocket.once("open", () => {
    clearTimeout(upgradeTimeout);
  });

  backendSocket.once("close", () => {
    clearTimeout(upgradeTimeout);
  });
});

server.listen(port, hostname, () => {
  console.log(`VPS Panel frontend listening on http://${hostname}:${port}`);

  console.log(`Terminal WebSocket proxy -> ${backendWsUrl}/api/v1/tmux/connect`);
});
