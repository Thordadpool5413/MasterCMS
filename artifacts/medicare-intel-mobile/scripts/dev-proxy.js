/**
 * dev-proxy.js
 *
 * Binds the health-check port (PORT, one of Replit's whitelisted ports) immediately
 * so the workflow health check passes, then starts Metro on an auxiliary port and
 * proxies all HTTP and WebSocket traffic to it.
 *
 * Also binds the Expo Dev Domain port (EXPO_PORT = PORT + 2000) so the Expo tunnel
 * can reach Metro. Both servers proxy to the same Metro instance.
 */
const http = require("http");
const net = require("net");
const { spawn } = require("child_process");

// PORT must be a Replit-whitelisted port (e.g. 8099) for the health check to pass.
// EXPO_PORT is for the Expo Dev Domain tunnel (e.g. 25690 provisioned by createArtifact).
const HEALTH_PORT = parseInt(process.env.PORT || "8099", 10);
const EXPO_PORT = parseInt(process.env.EXPO_PORT || "25690", 10);
const METRO_PORT = HEALTH_PORT + 1;

let metroReady = false;

function proxyHttp(req, res) {
  if (!metroReady) {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("Metro is starting\u2026");
    return;
  }

  const options = {
    hostname: "127.0.0.1",
    port: METRO_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${METRO_PORT}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502);
      res.end("Metro not reachable");
    }
  });

  req.pipe(proxyReq, { end: true });
}

function proxyWebSocket(req, socket, head) {
  const proxySocket = net.connect({ host: "127.0.0.1", port: METRO_PORT }, () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (const [k, v] of Object.entries(req.headers)) {
      lines.push(`${k}: ${v}`);
    }
    lines.push("", "");
    proxySocket.write(lines.join("\r\n"));
    if (head && head.length) proxySocket.write(head);
    socket.pipe(proxySocket);
    proxySocket.pipe(socket);
  });

  proxySocket.on("error", () => socket.destroy());
  socket.on("error", () => proxySocket.destroy());
}

// Health-check server on whitelisted port (e.g. 8099)
const healthServer = http.createServer(proxyHttp);
healthServer.on("upgrade", proxyWebSocket);
healthServer.listen(HEALTH_PORT, "0.0.0.0", () => {
  console.log(`[proxy] Health server on :${HEALTH_PORT} → Metro on :${METRO_PORT}`);
});

// Expo Dev Domain server on provisioned Expo port (e.g. 25690)
if (EXPO_PORT !== HEALTH_PORT) {
  const expoServer = http.createServer(proxyHttp);
  expoServer.on("upgrade", proxyWebSocket);
  expoServer.listen(EXPO_PORT, "0.0.0.0", () => {
    console.log(`[proxy] Expo server on :${EXPO_PORT} → Metro on :${METRO_PORT}`);
  });
}

function waitForMetro(cb) {
  function attempt() {
    const sock = net.connect({ host: "127.0.0.1", port: METRO_PORT });
    sock.on("connect", () => {
      sock.destroy();
      cb();
    });
    sock.on("error", () => {
      setTimeout(attempt, 1000);
    });
  }
  attempt();
}

const metroEnv = {
  ...process.env,
  PORT: String(METRO_PORT),
  EXPO_PACKAGER_PROXY_URL: process.env.EXPO_PACKAGER_PROXY_URL || "",
  EXPO_PUBLIC_DOMAIN: process.env.EXPO_PUBLIC_DOMAIN || "",
  EXPO_PUBLIC_REPL_ID: process.env.EXPO_PUBLIC_REPL_ID || "",
  REACT_NATIVE_PACKAGER_HOSTNAME: process.env.REACT_NATIVE_PACKAGER_HOSTNAME || "",
};

const metro = spawn(
  "pnpm",
  ["exec", "expo", "start", "--localhost", "--port", String(METRO_PORT)],
  { env: metroEnv, stdio: "inherit", cwd: __dirname + "/.." }
);

metro.on("error", (err) => {
  console.error("[proxy] Failed to start Metro:", err.message);
  process.exit(1);
});

metro.on("exit", (code) => {
  console.log("[proxy] Metro exited with code", code);
  process.exit(code ?? 0);
});

waitForMetro(() => {
  metroReady = true;
  console.log(`[proxy] Metro ready on :${METRO_PORT}`);
});

function shutdown() {
  metro.kill("SIGTERM");
  healthServer.close();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
