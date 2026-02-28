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
import { buildAccessibleWhere } from "@solved-problems/api/routers/solved-problems";
import { auth } from "@solved-problems/auth";
import prisma from "@solved-problems/db";
import { env } from "@solved-problems/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import JSZip from "jszip";
import { z } from "zod";
import {
  authenticateApiKey,
  createMcpServer,
  mcpContextStorage,
} from "./mcp/index.js";

type Bindings = HttpBindings;

const app = new Hono<{ Bindings: Bindings }>();

app.use(logger());
if (env.CORS_ORIGIN) {
  app.use(
    "/*",
    cors({
      origin: env.CORS_ORIGIN,
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  );
}

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

// --- Export endpoint ---
app.get("/api/export", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const settings = await prisma.siteSettings.findUnique({
    where: { id: "default" },
  });
  if (settings && !settings.exportEnabled) {
    return c.json({ error: "Export is disabled" }, 403);
  }

  const userId = session.user.id;
  const accessWhere = await buildAccessibleWhere(userId);

  const solvedProblems = await prisma.solvedProblem.findMany({
    where: accessWhere,
    include: {
      versions: {
        orderBy: { version: "asc" },
      },
      tags: {
        include: { tag: true },
      },
      dependencies: true,
    },
  });

  const zip = new JSZip();
  for (const sp of solvedProblems) {
    const json = {
      id: sp.id,
      name: sp.name,
      description: sp.description,
      appType: sp.appType,
      tags: sp.tags.map((t) => t.tag.name),
      dependencies: sp.dependencies.map((d) => ({
        name: d.name,
        version: d.version,
        packageManager: d.packageManager,
        type: d.type,
      })),
      versions: sp.versions.map((v) => ({
        version: v.version,
        details: v.details,
      })),
    };
    zip.file(`${sp.id}.json`, JSON.stringify(json, null, 2));
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  return new Response(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition":
        'attachment; filename="solved-problems-export.zip"',
    },
  });
});

// --- Import endpoint ---
const importItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string(),
  appType: z.string().min(1),
  tags: z.array(z.string()).optional(),
  dependencies: z
    .array(
      z.object({
        name: z.string().min(1),
        version: z.string().min(1),
        packageManager: z.string().min(1),
        type: z.enum(["SERVER", "CLIENT"]),
      }),
    )
    .optional(),
  versions: z
    .array(
      z.object({
        version: z.number(),
        details: z.string(),
      }),
    )
    .optional(),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

app.post("/api/import", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userId = session.user.id;
  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file provided" }, 400);
  }

  const items: unknown[] = [];
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".zip")) {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    for (const [name, entry] of Object.entries(zip.files)) {
      if (name.endsWith(".json") && !entry.dir) {
        const content = await entry.async("string");
        items.push(JSON.parse(content));
      }
    }
  } else if (fileName.endsWith(".json")) {
    const content = await file.text();
    items.push(JSON.parse(content));
  } else {
    return c.json({ error: "Unsupported file type. Use .json or .zip" }, 400);
  }

  const created: string[] = [];
  const drafted: string[] = [];
  const errors: string[] = [];

  for (const item of items) {
    try {
      const data = importItemSchema.parse(item);
      const slug = data.id || slugify(data.name);

      const existing = await prisma.solvedProblem.findUnique({
        where: { id: slug },
        select: { id: true, ownerId: true },
      });

      // Get the latest version details from imported data
      const latestVersion = data.versions?.length
        ? data.versions.sort((a, b) => b.version - a.version)[0]
        : undefined;

      if (existing && existing.ownerId === userId) {
        // User owns this problem — create a Draft (update proposal)
        const draft = await prisma.draft.create({
          data: {
            solvedProblemId: existing.id,
            createdByUserId: userId,
            proposedData: {
              name: data.name,
              description: data.description,
              appType: data.appType,
              tags: data.tags,
              dependencies: data.dependencies,
              details: latestVersion?.details,
            },
          },
        });
        drafted.push(draft.id);
      } else {
        // Create new solved problem
        let id = slug;
        if (existing) {
          id = `${slug}-${Date.now()}`;
        }

        const tagRecords = data.tags?.length
          ? await Promise.all(
              data.tags.map((name) =>
                prisma.tag.upsert({
                  where: { name },
                  create: { name },
                  update: {},
                }),
              ),
            )
          : [];

        await prisma.solvedProblem.create({
          data: {
            id,
            name: data.name,
            description: data.description,
            appType: data.appType,
            ownerId: userId,
            versions: data.versions?.length
              ? {
                  create: data.versions.map((v) => ({
                    version: v.version,
                    details: v.details,
                  })),
                }
              : undefined,
            tags: tagRecords.length
              ? {
                  create: tagRecords.map((tag) => ({
                    tagId: tag.id,
                  })),
                }
              : undefined,
            dependencies: data.dependencies?.length
              ? {
                  create: data.dependencies.map((dep) => ({
                    name: dep.name,
                    version: dep.version,
                    packageManager: dep.packageManager,
                    type: dep.type,
                  })),
                }
              : undefined,
          },
        });
        created.push(id);
      }
    } catch (err) {
      errors.push(
        err instanceof Error ? err.message : "Unknown error processing item",
      );
    }
  }

  return c.json({ created, drafted, errors });
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
