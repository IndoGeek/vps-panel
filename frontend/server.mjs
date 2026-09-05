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
});

server.on("upgrade", (request, socket, head) => {
  let requestUrl;

  try {
    requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  } catch {
    socket.destroy();
    return;
  }

  /*
   * Only intercept the VPS terminal WebSocket.
   *
   * Everything else is rejected here instead of accidentally
   * being forwarded to the backend.
   */
  if (requestUrl.pathname !== "/api/v1/tmux/connect") {
    socket.destroy();
    return;
  }

  websocketServer.handleUpgrade(request, socket, head, (browserSocket) => {
    const backendUrl = new URL(backendWsUrl);

    backendUrl.pathname = "/api/v1/tmux/connect";
    backendUrl.search = requestUrl.search;

    /*
     * Forward the browser's authentication cookie to the Go
     * backend. The backend uses this cookie to authenticate
     * the WebSocket connection.
     */
    const headers = {};

    if (request.headers.cookie) {
      headers.cookie = request.headers.cookie;
    }

    const backendSocket = new WebSocket(backendUrl.toString(), {
      headers,
    });

    let closed = false;

    const closeBoth = () => {
      if (closed) {
        return;
      }

      closed = true;

      try {
        browserSocket.close();
      } catch {}

      try {
        backendSocket.close();
      } catch {}
    };

    browserSocket.on("message", (data, isBinary) => {
      if (backendSocket.readyState !== WebSocket.OPEN) {
        return;
      }

      backendSocket.send(data, {
        binary: isBinary,
      });
    });

    backendSocket.on("message", (data, isBinary) => {
      if (browserSocket.readyState !== WebSocket.OPEN) {
        return;
      }

      browserSocket.send(data, {
        binary: isBinary,
      });
    });

    browserSocket.on("close", () => {
      closeBoth();
    });

    browserSocket.on("error", (error) => {
      console.error("Browser WebSocket error:", error);
      closeBoth();
    });

    backendSocket.on("open", () => {
      console.log(
        "Terminal WebSocket connected to backend:",
        backendUrl.pathname + backendUrl.search,
      );
    });

    backendSocket.on("close", () => {
      closeBoth();
    });

    backendSocket.on("error", (error) => {
      console.error("Backend terminal WebSocket error:", error);

      if (browserSocket.readyState === WebSocket.OPEN) {
        browserSocket.send("\r\n\x1b[31mTerminal backend connection failed.\x1b[0m\r\n");
      }

      closeBoth();
    });
  });
});

server.listen(port, hostname, () => {
  console.log(`VPS Panel frontend listening on http://${hostname}:${port}`);

  console.log(`Terminal WebSocket proxy -> ${backendWsUrl}/api/v1/tmux/connect`);
});
