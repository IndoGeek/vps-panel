import { createServer } from "node:http";
import { parse } from "node:url";

import next from "next";
import WebSocket, { WebSocketServer } from "ws";

const dev = process.env.NODE_ENV !== "production";

const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const backendWsUrl = process.env.BACKEND_WS_URL || "ws://127.0.0.1:8090";

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

  // Do not use compression for the terminal.
  // This keeps terminal frames simple and avoids unnecessary
  // extension negotiation on mobile browsers.
  perMessageDeflate: false,
});

websocketServer.on("connection", (browserSocket, request) => {
  console.log("Terminal browser WebSocket accepted:", request.url);

  browserSocket.on("close", (code, reason) => {
    console.log(
      "Terminal browser WebSocket closed:",
      `code=${code}`,
      `reason=${reason?.toString() || "<none>"}`,
    );
  });

  browserSocket.on("error", (error) => {
    console.error("Terminal browser WebSocket error:", error);
  });
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
   * Only handle the VPS terminal WebSocket.
   *
   * Other WebSocket paths must not be intercepted.
   */
  if (requestUrl.pathname !== "/api/v1/tmux/connect") {
    socket.destroy();
    return;
  }

  console.log("Terminal browser WebSocket upgrade:", requestUrl.pathname + requestUrl.search);

  websocketServer.handleUpgrade(request, socket, head, (browserSocket) => {
    websocketServer.emit("connection", browserSocket, request);

    const backendUrl = new URL(backendWsUrl);

    backendUrl.pathname = "/api/v1/tmux/connect";
    backendUrl.search = requestUrl.search;

    const headers = {};

    if (request.headers.cookie) {
      headers.cookie = request.headers.cookie;
    }

    console.log("Connecting terminal proxy to backend:", backendUrl.toString());

    const backendSocket = new WebSocket(backendUrl.toString(), {
      headers,
      perMessageDeflate: false,
    });

    let closed = false;

    const closeBoth = (reason = "proxy closed") => {
      if (closed) {
        return;
      }

      closed = true;

      console.log("Closing terminal proxy:", reason);

      if (
        browserSocket.readyState === WebSocket.OPEN ||
        browserSocket.readyState === WebSocket.CONNECTING
      ) {
        try {
          browserSocket.close(1000, reason.slice(0, 120));
        } catch {}
      }

      if (
        backendSocket.readyState === WebSocket.OPEN ||
        backendSocket.readyState === WebSocket.CONNECTING
      ) {
        try {
          backendSocket.close(1000, reason.slice(0, 120));
        } catch {}
      }
    };

    browserSocket.on("message", (data, isBinary) => {
      if (backendSocket.readyState !== WebSocket.OPEN) {
        return;
      }

      try {
        backendSocket.send(data, {
          binary: isBinary,
        });
      } catch (error) {
        console.error("Browser -> backend terminal send failed:", error);

        closeBoth("browser to backend send failed");
      }
    });

    backendSocket.on("message", (data, isBinary) => {
      if (browserSocket.readyState !== WebSocket.OPEN) {
        return;
      }

      try {
        browserSocket.send(data, {
          binary: isBinary,
        });
      } catch (error) {
        console.error("Backend -> browser terminal send failed:", error);

        closeBoth("backend to browser send failed");
      }
    });

    backendSocket.on("open", () => {
      console.log(
        "Terminal WebSocket connected to backend:",
        backendUrl.pathname + backendUrl.search,
      );
    });

    backendSocket.on("close", (code, reason) => {
      console.log(
        "Terminal backend WebSocket closed:",
        `code=${code}`,
        `reason=${reason?.toString() || "<none>"}`,
      );

      closeBoth(`backend closed ${code} ${reason?.toString() || ""}`.trim());
    });

    backendSocket.on("error", (error) => {
      console.error("Backend terminal WebSocket error:", error);

      closeBoth("backend websocket error");
    });

    browserSocket.on("close", (code, reason) => {
      console.log(
        "Terminal browser socket closed:",
        `code=${code}`,
        `reason=${reason?.toString() || "<none>"}`,
      );

      if (!closed) {
        closed = true;

        if (
          backendSocket.readyState === WebSocket.OPEN ||
          backendSocket.readyState === WebSocket.CONNECTING
        ) {
          backendSocket.close(1000, "browser disconnected");
        }
      }
    });

    browserSocket.on("error", (error) => {
      console.error("Browser terminal WebSocket error:", error);

      closeBoth("browser websocket error");
    });

    /*
     * Keep the internal connection alive.
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
          closeBoth("backend ping failed");
        }
      }
    }, 30000);

    const cleanupHeartbeat = () => {
      clearInterval(heartbeat);
    };

    browserSocket.once("close", cleanupHeartbeat);
    backendSocket.once("close", cleanupHeartbeat);
  });
});

server.listen(port, hostname, () => {
  console.log(`VPS Panel frontend listening on http://${hostname}:${port}`);

  console.log(`Terminal WebSocket proxy -> ${backendWsUrl}/api/v1/tmux/connect`);
});
