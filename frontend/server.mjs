import { createServer } from "node:http";
import { parse } from "node:url";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import next from "next";
import WebSocket, { WebSocketServer } from "ws";

const dev = process.env.NODE_ENV !== "production";

const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

/*
 * IMPORTANT:
 *
 * The frontend MUST connect to the Go backend.
 *
 * Backend:
 *
 *   127.0.0.1:8090
 *
 * Agent:
 *
 *   127.0.0.1:8091
 *
 * The backend is the authenticated boundary and already
 * contains the terminal WebSocket proxy.
 */
const backendWsUrl = process.env.BACKEND_WS_URL || "ws://127.0.0.1:8090";

/*
 * --------------------------------------------------------------------------
 * Logging
 * --------------------------------------------------------------------------
 *
 * Logs are written to:
 *
 *   <project>/logs/frontend.log
 *   <project>/logs/terminal.log
 *
 * VPS_PANEL_LOG_DIR can override the directory.
 */

const logDirectory = process.env.VPS_PANEL_LOG_DIR || path.resolve(process.cwd(), "logs");

mkdirSync(logDirectory, {
  recursive: true,
});

const ANSI = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

function classifyMessage(message) {
  const lower = String(message).toLowerCase();

  if (
    lower.includes("error") ||
    lower.includes("failed") ||
    lower.includes("failure") ||
    lower.includes("fatal") ||
    lower.includes("exception") ||
    lower.includes("timeout")
  ) {
    return {
      name: "ERROR",
      color: ANSI.red,
    };
  }

  if (lower.includes("warn") || lower.includes("warning")) {
    return {
      name: "WARN",
      color: ANSI.yellow,
    };
  }

  if (lower.includes("debug")) {
    return {
      name: "DEBUG",
      color: ANSI.gray,
    };
  }

  return {
    name: "INFO",
    color: ANSI.cyan,
  };
}

function createLogger(fileName) {
  const filePath = path.join(logDirectory, fileName);

  return {
    info(...values) {
      writeLog(filePath, "INFO", values);
    },

    warn(...values) {
      writeLog(filePath, "WARN", values);
    },

    error(...values) {
      writeLog(filePath, "ERROR", values);
    },

    debug(...values) {
      writeLog(filePath, "DEBUG", values);
    },
  };
}

function serializeValue(value) {
  if (value instanceof Error) {
    return value.stack || value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function writeLog(filePath, explicitLevel, values) {
  const timestamp = new Date().toISOString();

  const message = values.map(serializeValue).join(" ");

  const detected = classifyMessage(message);

  const level =
    explicitLevel === "ERROR"
      ? "ERROR"
      : explicitLevel === "WARN"
        ? "WARN"
        : explicitLevel === "DEBUG"
          ? "DEBUG"
          : detected.name;

  const color =
    level === "ERROR"
      ? ANSI.red
      : level === "WARN"
        ? ANSI.yellow
        : level === "DEBUG"
          ? ANSI.gray
          : ANSI.cyan;

  const plainLine = `${timestamp} [${level}] ${message}\n`;

  const terminalLine = `${color}${timestamp} [${level}]${ANSI.reset} ${message}\n`;

  try {
    appendFileSync(filePath, plainLine, {
      encoding: "utf8",
    });
  } catch (error) {
    process.stderr.write(
      `${ANSI.red}[ERROR]${ANSI.reset} ` +
        `Failed to write log file ${filePath}: ` +
        `${error.message}\n`,
    );
  }

  process.stdout.write(terminalLine);
}

const logger = createLogger("frontend.log");

const terminalLogger = createLogger("terminal.log");

logger.info("Starting VPS Panel frontend server.");

logger.info(`Terminal backend URL: ${backendWsUrl}`);

/*
 * --------------------------------------------------------------------------
 * Next.js
 * --------------------------------------------------------------------------
 */

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
    logger.error("Next.js request error:", error);

    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Internal server error");
    }
  }
});

/*
 * --------------------------------------------------------------------------
 * Browser WebSocket server
 * --------------------------------------------------------------------------
 */

const websocketServer = new WebSocketServer({
  noServer: true,
  perMessageDeflate: false,
});

/*
 * --------------------------------------------------------------------------
 * WebSocket upgrade
 * --------------------------------------------------------------------------
 */

server.on("upgrade", (request, socket, head) => {
  let requestUrl;

  try {
    requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  } catch (error) {
    terminalLogger.error("Invalid WebSocket URL:", error);

    socket.destroy();

    return;
  }

  /*
   * Only our terminal endpoint belongs
   * to this custom WebSocket proxy.
   */
  if (requestUrl.pathname !== "/terminal-ws") {
    socket.destroy();

    return;
  }

  terminalLogger.info(
    "Browser terminal WebSocket upgrade requested.",
    `path=${requestUrl.pathname}`,
    `query=${requestUrl.search}`,
    `remote=${request.socket.remoteAddress || "<unknown>"}`,
  );

  /*
   * Accept the browser WebSocket FIRST.
   *
   * This is important.
   *
   * If the backend is unavailable, we can now send
   * an actual WebSocket close frame instead of simply
   * destroying the raw HTTP socket.
   */
  websocketServer.handleUpgrade(request, socket, head, (browserSocket) => {
    websocketServer.emit("connection", browserSocket, request);

    handleTerminalConnection(browserSocket, request, requestUrl);
  });
});

/*
 * --------------------------------------------------------------------------
 * Terminal connection
 * --------------------------------------------------------------------------
 */

function handleTerminalConnection(browserSocket, request, requestUrl) {
  let closed = false;
  let backendOpened = false;

  const session = requestUrl.searchParams.get("name") || "<missing>";

  /*
   * Build backend WebSocket URL.
   *
   * IMPORTANT:
   *
   * This MUST resolve to port 8090.
   */
  const backendUrl = new URL(backendWsUrl);

  backendUrl.pathname = "/api/v1/tmux/connect";

  backendUrl.search = requestUrl.search;

  /*
   * Forward authentication cookies.
   *
   * The backend uses the user's session
   * cookie to authenticate the terminal.
   */
  const headers = {};

  if (request.headers.cookie) {
    headers.cookie = request.headers.cookie;
  }

  /*
   * Forward useful proxy information.
   *
   * Do NOT forward the browser Origin.
   *
   * The backend accepts the internal WebSocket
   * connection without an Origin header.
   */
  if (request.headers["x-forwarded-for"]) {
    headers["x-forwarded-for"] = request.headers["x-forwarded-for"];
  }

  headers["x-forwarded-proto"] = request.headers["x-forwarded-proto"] || "https";

  terminalLogger.info(
    "Opening backend terminal WebSocket.",
    `session=${session}`,
    `target=${backendUrl.toString()}`,
  );

  const backendSocket = new WebSocket(backendUrl.toString(), {
    headers,
    perMessageDeflate: false,

    handshakeTimeout: 10000,
  });

  /*
   * Close helper.
   */
  const closeBrowser = (code, reason) => {
    if (
      browserSocket.readyState === WebSocket.OPEN ||
      browserSocket.readyState === WebSocket.CONNECTING
    ) {
      try {
        browserSocket.close(code, String(reason).slice(0, 120));
      } catch {}
    }
  };

  const closeBackend = (code = 1000, reason = "proxy closed") => {
    if (
      backendSocket.readyState === WebSocket.OPEN ||
      backendSocket.readyState === WebSocket.CONNECTING
    ) {
      try {
        backendSocket.close(code, String(reason).slice(0, 120));
      } catch {}
    }
  };

  /*
   * Backend WebSocket opened.
   */
  backendSocket.on("open", () => {
    backendOpened = true;

    terminalLogger.info(
      "Backend terminal WebSocket connected.",
      `session=${session}`,
      `target=${backendUrl.toString()}`,
    );
  });

  /*
   * Very important diagnostic event.
   *
   * This catches HTTP 401/404/500 responses
   * instead of hiding them behind a generic
   * WebSocket error.
   */
  backendSocket.on("unexpected-response", async (_request, response) => {
    let body = "";

    try {
      body = await readResponseBody(response);
    } catch {}

    terminalLogger.error(
      "Backend rejected terminal WebSocket upgrade.",
      `session=${session}`,
      `status=${response.statusCode}`,
      `statusMessage=${response.statusMessage || "<none>"}`,
      `body=${body || "<empty>"}`,
    );

    closeBrowser(
      response.statusCode === 401 ? 1008 : 1011,
      response.statusCode === 401 ? "authentication required" : "backend rejected terminal",
    );

    try {
      backendSocket.terminate();
    } catch {}
  });

  /*
   * Backend error.
   */
  backendSocket.on("error", (error) => {
    terminalLogger.error("Backend terminal WebSocket error.", `session=${session}`, error);

    if (!closed) {
      closeBrowser(1011, "backend websocket error");
    }
  });

  /*
   * Backend closed.
   */
  backendSocket.on("close", (code, reason) => {
    terminalLogger.warn(
      "Backend terminal WebSocket closed.",
      `session=${session}`,
      `code=${code}`,
      `reason=${reason?.toString() || "<none>"}`,
    );

    if (closed) {
      return;
    }

    closed = true;

    /*
     * Never expose the backend's internal
     * close code directly to the browser if
     * it is outside the valid browser range.
     */
    closeBrowser(code >= 1000 && code <= 4999 ? code : 1011, "backend disconnected");
  });

  /*
   * Browser -> backend.
   */
  browserSocket.on("message", (data, isBinary) => {
    if (backendSocket.readyState !== WebSocket.OPEN) {
      terminalLogger.warn(
        "Browser sent terminal data while backend socket was not open.",
        `session=${session}`,
        `backendState=${backendSocket.readyState}`,
      );

      return;
    }

    try {
      backendSocket.send(data, {
        binary: isBinary,
      });
    } catch (error) {
      terminalLogger.error("Browser -> backend terminal send failed.", `session=${session}`, error);

      closeBrowser(1011, "terminal proxy error");

      closeBackend(1011, "browser send failed");
    }
  });

  /*
   * Backend -> browser.
   */
  backendSocket.on("message", (data, isBinary) => {
    if (browserSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      browserSocket.send(data, {
        binary: isBinary,
      });
    } catch (error) {
      terminalLogger.error("Backend -> browser terminal send failed.", `session=${session}`, error);

      closeBrowser(1011, "terminal proxy error");

      closeBackend(1011, "browser send failed");
    }
  });

  /*
   * Browser closed.
   */
  browserSocket.on("close", (code, reason) => {
    terminalLogger.warn(
      "Browser terminal WebSocket closed.",
      `session=${session}`,
      `code=${code}`,
      `reason=${reason?.toString() || "<none>"}`,
    );

    if (closed) {
      return;
    }

    closed = true;

    closeBackend(
      code >= 1000 && code <= 4999 ? code : 1000,
      reason?.toString() || "browser disconnected",
    );
  });

  /*
   * Browser error.
   */
  browserSocket.on("error", (error) => {
    terminalLogger.error("Browser terminal WebSocket error.", `session=${session}`, error);

    if (closed) {
      return;
    }

    closed = true;

    closeBackend(1011, "browser websocket error");
  });

  /*
   * Keep the browser <-> frontend hop alive.
   *
   * The Go backend already has its own
   * frontend <-> agent heartbeat.
   */
  const heartbeat = setInterval(() => {
    if (closed) {
      clearInterval(heartbeat);

      return;
    }

    if (browserSocket.readyState === WebSocket.OPEN) {
      try {
        browserSocket.ping();
      } catch (error) {
        terminalLogger.error("Browser terminal ping failed.", `session=${session}`, error);

        clearInterval(heartbeat);

        closeBrowser(1011, "browser ping failed");

        closeBackend(1011, "browser ping failed");
      }
    }

    if (backendSocket.readyState === WebSocket.OPEN) {
      try {
        backendSocket.ping();
      } catch (error) {
        terminalLogger.error("Backend terminal ping failed.", `session=${session}`, error);

        clearInterval(heartbeat);

        closeBrowser(1011, "backend ping failed");

        closeBackend(1011, "backend ping failed");
      }
    }
  }, 25000);

  browserSocket.once("close", () => {
    clearInterval(heartbeat);
  });

  backendSocket.once("close", () => {
    clearInterval(heartbeat);
  });

  /*
   * Backend connection timeout.
   */
  const timeout = setTimeout(() => {
    if (!backendOpened && !closed) {
      terminalLogger.error(
        "Backend terminal WebSocket connection timed out.",
        `session=${session}`,
        `target=${backendUrl.toString()}`,
      );

      closeBrowser(1013, "backend connection timeout");

      try {
        backendSocket.terminate();
      } catch {}
    }
  }, 10000);

  backendSocket.once("open", () => {
    clearTimeout(timeout);
  });

  backendSocket.once("close", () => {
    clearTimeout(timeout);
  });
}

/*
 * Read a failed WebSocket HTTP response body
 * for diagnostics.
 */
function readResponseBody(response) {
  return new Promise((resolve) => {
    let body = "";

    response.setEncoding("utf8");

    response.on("data", (chunk) => {
      body += chunk;
    });

    response.on("end", () => {
      resolve(body.slice(0, 2000));
    });

    response.on("error", () => {
      resolve(body);
    });
  });
}

/*
 * --------------------------------------------------------------------------
 * HTTP server
 * --------------------------------------------------------------------------
 */

server.listen(port, hostname, () => {
  logger.info("VPS Panel frontend is listening.", `address=http://${hostname}:${port}`);

  logger.info("Terminal WebSocket endpoint: /terminal-ws");

  logger.info("Terminal upstream:", `${backendWsUrl}/api/v1/tmux/connect`);
});

server.on("error", (error) => {
  logger.error("Frontend HTTP server error:", error);
});
