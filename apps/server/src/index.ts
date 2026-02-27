import { StreamableHTTPTransport } from "@hono/mcp";
import type { HttpBindings } from "@hono/node-server";
import { RESPONSE_ALREADY_SENT } from "@hono/node-server/utils/response";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createContext } from "@solved-problems/api/context";
import { appRouter } from "@solved-problems/api/routers/index";
import { auth } from "@solved-problems/auth";
import { env } from "@solved-problems/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import {
  authenticateApiKey,
  createMcpServer,
  mcpContextStorage,
} from "./mcp/index.js";

type Bindings = HttpBindings;

const app = new Hono<{ Bindings: Bindings }>();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// MCP Server setup
const mcpServer = createMcpServer();
const mcpTransport = new StreamableHTTPTransport();

let mcpConnected = false;
async function ensureMcpConnected() {
  if (!mcpConnected) {
    await mcpServer.connect(mcpTransport);
    mcpConnected = true;
  }
}

app.all("/mcp", async (c) => {
  const authResult = await authenticateApiKey(
    c.req.header("Authorization"),
  );

  if (!authResult) {
    return c.json({ error: "Invalid or revoked API key" }, 401);
  }

  await ensureMcpConnected();
  return mcpContextStorage.run(authResult, () =>
    mcpTransport.handleRequest(c),
  );
});

export const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

app.use("/*", async (c, next) => {
  const context = await createContext({ context: c });

  const rpcResult = await rpcHandler.handle(c.req.raw, {
    prefix: "/rpc",
    context: context,
  });

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response);
  }

  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: "/api-reference",
    context: context,
  });

  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body, apiResult.response);
  }

  await next();
});

if (process.env.NODE_ENV === "production") {
  const next = (await import("next")).default;
  const nextApp = next({ dev: false, dir: "../web" });
  await nextApp.prepare();
  const nextHandler = nextApp.getRequestHandler();

  app.use("/_next/*", async (c) => {
    await nextHandler(c.env.incoming, c.env.outgoing);
    return RESPONSE_ALREADY_SENT;
  });

  app.use("/*", async (c) => {
    await nextHandler(c.env.incoming, c.env.outgoing);
    return RESPONSE_ALREADY_SENT;
  });
} else {
  app.get("/", (c) => {
    return c.text("OK");
  });
}

import { serve } from "@hono/node-server";

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
