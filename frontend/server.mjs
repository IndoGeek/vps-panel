import { createServer } from "node:http";
import { parse } from "node:url";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import next from "next";
import WebSocket, { WebSocketServer } from "ws";

/*
 * --------------------------------------------------------------------------
 * Environment loading
 * --------------------------------------------------------------------------
 *
 * PM2 does NOT automatically load the project's .env file.
 *
 * The frontend lives at:
 *
 *   /home/tanmay/Code/vps-panel/frontend
 *
 * while the .env lives at:
 *
 *   /home/tanmay/Code/vps-panel/.env
 *
 * Load the project .env before reading configuration.
 */

function parseEnvValue(value) {
  const trimmed = value.trim();

  if (trimmed.length >= 2) {
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      return trimmed.slice(1, -1);
    }

    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1);
    }
  }

  return trimmed;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  let content;

  try {
    content = readFileSync(filePath, "utf8");
  } catch (error) {
    process.stderr.write(`[ERROR] Failed to read environment file ${filePath}: ${error.message}\n`);

    return;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    let line = rawLine.trim();

    if (line === "" || line.startsWith("#")) {
      continue;
    }

    if (line.startsWith("export ")) {
      line = line.slice(7).trim();
    }

    const separator = line.indexOf("=");

    if (separator <= 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();

    const value = parseEnvValue(line.slice(separator + 1));

    if (!key) {
      continue;
    }

    /*
     * Never override an environment variable already
     * explicitly supplied by PM2/systemd/the shell.
     */
    if (process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = value;
  }
}

function findProjectEnv() {
  let current = process.cwd();

  while (true) {
    const candidate = path.join(current, ".env");

    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      break;
    }

    current = parent;
  }

  return null;
}

const projectEnvPath = findProjectEnv();

if (projectEnvPath) {
  loadEnvFile(projectEnvPath);
}

/*
 * --------------------------------------------------------------------------
 * Configuration
 * --------------------------------------------------------------------------
 */

const dev = process.env.NODE_ENV !== "production";

const hostname = process.env.HOSTNAME || "0.0.0.0";

const port = Number(process.env.PORT || 3000);

const backendWsUrl = process.env.BACKEND_WS_URL || "ws://127.0.0.1:8090";

/*
 * Always use the central project log directory.
 *
 * This is intentionally NOT:
 *
 *   frontend/logs
 *
 * unless VPS_PANEL_LOG_DIR is explicitly changed.
 */

const logDirectory = process.env.VPS_PANEL_LOG_DIR || path.resolve(process.cwd(), "..", "logs");

mkdirSync(logDirectory, {
  recursive: true,
});

/*
 * --------------------------------------------------------------------------
 * Logging
 * --------------------------------------------------------------------------
 */

const ANSI = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

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

function createLogger(fileName) {
  const filePath = path.join(logDirectory, fileName);

  /*
   * Create the file immediately.
   *
   * This means terminal.log exists even before
   * the first terminal connection.
   */
  try {
    appendFileSync(filePath, "", {
      encoding: "utf8",
    });
  } catch (error) {
    process.stderr.write(
      `${ANSI.red}[ERROR]${ANSI.reset} ` +
        `Unable to create log file ${filePath}: ` +
        `${error.message}\n`,
    );
  }

  function write(level, values) {
    const timestamp = new Date().toISOString();

    const message = values.map(serializeValue).join(" ");

    const color =
      level === "ERROR"
        ? ANSI.red
        : level === "WARN"
          ? ANSI.yellow
          : level === "DEBUG"
            ? ANSI.gray
            : ANSI.cyan;

    const plainLine = `${timestamp} [${level}] ${message}\n`;

    const terminalLine = `${color}${timestamp} [${level}]${ANSI.reset} ` + `${message}\n`;

    try {
      appendFileSync(filePath, plainLine, {
        encoding: "utf8",
      });
    } catch (error) {
      process.stderr.write(
        `${ANSI.red}[ERROR]${ANSI.reset} ` + `Failed writing ${filePath}: ` + `${error.message}\n`,
      );
    }

    process.stdout.write(terminalLine);
  }

  return {
    info(...values) {
      write("INFO", values);
    },

    warn(...values) {
      write("WARN", values);
    },

    error(...values) {
      write("ERROR", values);
    },

    debug(...values) {
      write("DEBUG", values);
    },
  };
}

const logger = createLogger("frontend.log");

const terminalLogger = createLogger("terminal.log");

logger.info("Starting VPS Panel frontend server.");

logger.info(`Environment: NODE_ENV=${process.env.NODE_ENV || "<unset>"}`);

logger.info(`Project .env: ${projectEnvPath || "<not found>"}`);

logger.info(`Log directory: ${logDirectory}`);

logger.info(`Backend WebSocket URL: ${backendWsUrl}`);

logger.info(`Frontend bind: ${hostname}:${port}`);

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

/*
 * --------------------------------------------------------------------------
 * HTTP server
 * --------------------------------------------------------------------------
 */

const server = createServer(async (req, res) => {
  try {
    const parsedUrl = parse(req.url, true);

    await handle(req, res, parsedUrl);
  } catch (error) {
    logger.error("Next.js request error.", error);

    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Internal server error");
    }
  }
});

/*
 * --------------------------------------------------------------------------
 * WebSocket server
 * --------------------------------------------------------------------------
 */

const websocketServer = new WebSocketServer({
  noServer: true,

  /*
   * Terminal traffic does not need
   * compression.
   */
  perMessageDeflate: false,

  maxPayload: 1024 * 1024,
});

/*
 * --------------------------------------------------------------------------
 * HTTP -> WebSocket upgrade
 * --------------------------------------------------------------------------
 */

server.on("upgrade", (request, socket, head) => {
  const rawUrl = request.url || "/";

  terminalLogger.info(
    "HTTP upgrade request received.",
    `url=${rawUrl}`,
    `host=${request.headers.host || "<missing>"}`,
    `upgrade=${request.headers.upgrade || "<missing>"}`,
    `connection=${request.headers.connection || "<missing>"}`,
    `origin=${request.headers.origin || "<missing>"}`,
    `remote=${request.socket.remoteAddress || "<unknown>"}`,
    `cookie=${request.headers.cookie ? "present" : "missing"}`,
  );

  let requestUrl;

  try {
    requestUrl = new URL(rawUrl, `http://${request.headers.host || "localhost"}`);
  } catch (error) {
    terminalLogger.error("Invalid WebSocket URL.", error);

    socket.destroy();

    return;
  }

  /*
   * Only /terminal-ws is handled here.
   */
  if (requestUrl.pathname !== "/terminal-ws") {
    terminalLogger.warn(
      "WebSocket request rejected because path is not /terminal-ws.",
      `path=${requestUrl.pathname}`,
    );

    socket.destroy();

    return;
  }

  const session = requestUrl.searchParams.get("name") || "<missing>";

  terminalLogger.info(
    "Browser terminal WebSocket upgrade requested.",
    `session=${session}`,
    `path=${requestUrl.pathname}`,
    `query=${requestUrl.search}`,
    `remote=${request.socket.remoteAddress || "<unknown>"}`,
  );

  /*
   * Accept the browser WebSocket.
   */
  websocketServer.handleUpgrade(request, socket, head, (browserSocket) => {
    terminalLogger.info("Browser WebSocket handshake accepted.", `session=${session}`);

    websocketServer.emit("connection", browserSocket, request);

    handleTerminalConnection(browserSocket, request, requestUrl);
  });
});

/*
 * Raw HTTP socket errors.
 *
 * This catches failures that happen before
 * WebSocket connection establishment.
 */
server.on("clientError", (error, socket) => {
  terminalLogger.error("HTTP client socket error.", error);

  try {
    socket.destroy();
  } catch {}
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

  const backendUrl = new URL(backendWsUrl);

  backendUrl.pathname = "/api/v1/tmux/connect";

  backendUrl.search = requestUrl.search;

  /*
   * Forward the authentication cookie.
   */
  const headers = {};

  if (request.headers.cookie) {
    headers.cookie = request.headers.cookie;
  }

  /*
   * Forward proxy information.
   */
  if (request.headers["x-forwarded-for"]) {
    headers["x-forwarded-for"] = request.headers["x-forwarded-for"];
  }

  headers["x-forwarded-proto"] = request.headers["x-forwarded-proto"] || "https";

  terminalLogger.info(
    "Opening backend terminal WebSocket.",
    `session=${session}`,
    `target=${backendUrl.toString()}`,
    `cookie=${headers.cookie ? "forwarded" : "missing"}`,
  );

  const backendSocket = new WebSocket(backendUrl.toString(), {
    headers,

    perMessageDeflate: false,

    handshakeTimeout: 10000,
  });

  /*
   * Close browser helper.
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

  /*
   * Close backend helper.
   */
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
   * Backend connected.
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
   * Backend returned an HTTP error
   * instead of 101 Switching Protocols.
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
   * Backend connection error.
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
   * Keep both WebSocket hops alive.
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
 * --------------------------------------------------------------------------
 * Backend HTTP error body reader
 * --------------------------------------------------------------------------
 */

function readResponseBody(response) {
  return new Promise((resolve) => {
    let body = "";

    response.setEncoding("utf8");

    response.on("data", (chunk) => {
      body += chunk;
    });

    response.on("end", () => {
      resolve(body.slice(0, 4000));
    });

    response.on("error", () => {
      resolve(body);
    });
  });
}

/*
 * --------------------------------------------------------------------------
 * HTTP server startup
 * --------------------------------------------------------------------------
 */

server.listen(port, hostname, () => {
  logger.info("VPS Panel frontend is listening.", `address=http://${hostname}:${port}`);

  logger.info("Terminal WebSocket endpoint: /terminal-ws");

  logger.info("Terminal upstream:", `${backendWsUrl}/api/v1/tmux/connect`);

  terminalLogger.info(
    "Terminal WebSocket subsystem initialized.",
    `endpoint=/terminal-ws`,
    `upstream=${backendWsUrl}/api/v1/tmux/connect`,
  );
});

server.on("error", (error) => {
  logger.error("Frontend HTTP server error.", error);
});

process.on("SIGINT", () => {
  logger.info("Frontend received SIGINT. Shutting down.");

  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Frontend received SIGTERM. Shutting down.");

  process.exit(0);
});
