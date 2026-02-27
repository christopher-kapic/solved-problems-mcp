import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import prisma from "@solved-problems/db";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { z } from "zod";

export interface McpContext {
  userId: string;
  apiKeyId: string;
}

export const mcpContextStorage = new AsyncLocalStorage<McpContext>();

function getMcpContext(): McpContext {
  const ctx = mcpContextStorage.getStore();
  if (!ctx) {
    throw new Error("MCP context not available");
  }
  return ctx;
}

/**
 * Authenticate an API key from the Authorization header.
 * Returns the userId and apiKeyId if valid, or null if invalid.
 */
export async function authenticateApiKey(
  authHeader: string | undefined,
): Promise<McpContext | null> {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const plainKey = authHeader.slice(7);
  const hashedKey = createHash("sha256").update(plainKey).digest("hex");

  const apiKey = await prisma.apiKey.findUnique({
    where: { hashedKey },
    select: { id: true, userId: true, revokedAt: true },
  });

  if (!apiKey || apiKey.revokedAt !== null) {
    return null;
  }

  return { userId: apiKey.userId, apiKeyId: apiKey.id };
}

/**
 * Build a list of solved problem IDs that an API key has access to.
 * Resolves both direct SOLVED_PROBLEM access and GROUP membership access.
 */
async function getAccessibleSolvedProblemIds(
  apiKeyId: string,
): Promise<string[]> {
  const accesses = await prisma.apiKeyAccess.findMany({
    where: { apiKeyId },
    select: { resourceType: true, resourceId: true },
  });

  const directIds: string[] = [];
  const groupIds: string[] = [];

  for (const access of accesses) {
    if (access.resourceType === "SOLVED_PROBLEM") {
      directIds.push(access.resourceId);
    } else if (access.resourceType === "GROUP") {
      groupIds.push(access.resourceId);
    }
  }

  // Resolve group memberships to solved problem IDs
  let groupMemberIds: string[] = [];
  if (groupIds.length > 0) {
    const memberships = await prisma.groupMembership.findMany({
      where: { groupId: { in: groupIds } },
      select: { solvedProblemId: true },
    });
    groupMemberIds = memberships.map((m) => m.solvedProblemId);
  }

  // Deduplicate
  return [...new Set([...directIds, ...groupMemberIds])];
}

export function createMcpServer(): McpServer {
  const mcpServer = new McpServer(
    {
      name: "solved-problems",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  mcpServer.tool(
    "list_solved_problems",
    "List solved problems accessible to this API key. Optionally filter by server dependencies, client dependencies, tags (case-insensitive matching), or date range (updatedBefore/updatedAfter).",
    {
      server_dependencies: z
        .array(z.string())
        .optional()
        .describe("Filter by server-side dependency names"),
      client_dependencies: z
        .array(z.string())
        .optional()
        .describe("Filter by client-side dependency names"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Filter by tag names"),
      updated_after: z
        .string()
        .optional()
        .describe(
          "Filter to solved problems updated after this date. ISO 8601 format (e.g. '2025-01-15' or '2025-01-15T08:30:00Z').",
        ),
      updated_before: z
        .string()
        .optional()
        .describe(
          "Filter to solved problems updated before this date. ISO 8601 format (e.g. '2025-06-01' or '2025-06-01T23:59:59Z').",
        ),
    },
    async (params) => {
      const ctx = getMcpContext();
      const accessibleIds = await getAccessibleSolvedProblemIds(ctx.apiKeyId);

      if (accessibleIds.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify([]),
            },
          ],
        };
      }

      // Parse date filters
      const updatedAfter = params.updated_after
        ? new Date(params.updated_after)
        : undefined;
      const updatedBefore = params.updated_before
        ? new Date(params.updated_before)
        : undefined;

      if (
        (updatedAfter && isNaN(updatedAfter.getTime())) ||
        (updatedBefore && isNaN(updatedBefore.getTime()))
      ) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error:
                  "Invalid date format. Use ISO 8601 (e.g. '2025-01-15' or '2025-01-15T08:30:00Z').",
              }),
            },
          ],
        };
      }

      const where: Record<string, unknown> = {
        AND: [
          { id: { in: accessibleIds } },
          ...(updatedAfter ? [{ updatedAt: { gte: updatedAfter } }] : []),
          ...(updatedBefore ? [{ updatedAt: { lte: updatedBefore } }] : []),
          ...(params.tags && params.tags.length > 0
            ? [
                {
                  tags: {
                    some: {
                      tag: {
                        name: {
                          in: params.tags,
                          mode: "insensitive" as const,
                        },
                      },
                    },
                  },
                },
              ]
            : []),
          ...(params.server_dependencies &&
          params.server_dependencies.length > 0
            ? [
                {
                  dependencies: {
                    some: {
                      type: "SERVER" as const,
                      name: {
                        in: params.server_dependencies,
                        mode: "insensitive" as const,
                      },
                    },
                  },
                },
              ]
            : []),
          ...(params.client_dependencies &&
          params.client_dependencies.length > 0
            ? [
                {
                  dependencies: {
                    some: {
                      type: "CLIENT" as const,
                      name: {
                        in: params.client_dependencies,
                        mode: "insensitive" as const,
                      },
                    },
                  },
                },
              ]
            : []),
        ],
      };

      const solvedProblems = await prisma.solvedProblem.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          appType: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
      });

      const results = solvedProblems.map((sp) => ({
        id: sp.id,
        name: sp.name,
        description: sp.description,
        appType: sp.appType,
        updatedAt: sp.updatedAt.toISOString(),
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(results),
          },
        ],
      };
    },
  );

  mcpServer.tool(
    "get_solved_problems",
    "Get full details of solved problems by their IDs. Returns all fields including latest version details, tags, and dependencies. Only returns data for solved problems the API key has access to.",
    {
      ids: z
        .array(z.string())
        .describe("IDs (slugs) of solved problems to retrieve"),
    },
    async (params) => {
      const ctx = getMcpContext();
      const accessibleIds = await getAccessibleSolvedProblemIds(ctx.apiKeyId);

      // Filter requested IDs to only those accessible
      const allowedIds = params.ids.filter((id) => accessibleIds.includes(id));

      if (allowedIds.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify([]),
            },
          ],
        };
      }

      const solvedProblems = await prisma.solvedProblem.findMany({
        where: { id: { in: allowedIds } },
        include: {
          tags: {
            include: { tag: true },
          },
          dependencies: true,
          versions: {
            orderBy: { version: "desc" },
            take: 1,
          },
        },
      });

      const results = solvedProblems.map((sp) => ({
        id: sp.id,
        name: sp.name,
        description: sp.description,
        appType: sp.appType,
        copiedFromId: sp.copiedFromId,
        createdAt: sp.createdAt.toISOString(),
        updatedAt: sp.updatedAt.toISOString(),
        tags: sp.tags.map((t) => t.tag.name),
        dependencies: sp.dependencies.map((d) => ({
          name: d.name,
          version: d.version,
          packageManager: d.packageManager,
          type: d.type,
        })),
        latestVersion: sp.versions[0]
          ? {
              version: sp.versions[0].version,
              details: sp.versions[0].details,
              createdAt: sp.versions[0].createdAt.toISOString(),
            }
          : null,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(results),
          },
        ],
      };
    },
  );

  mcpServer.tool(
    "draft_solved_problem",
    "Propose a new solved problem or an update to an existing one. Creates a Draft record with PENDING status for the owner to review in the web UI.",
    {
      id: z
        .string()
        .optional()
        .describe(
          "ID of an existing solved problem to propose an update to. Omit for a new solved problem proposal.",
        ),
      name: z.string().describe("Name of the solved problem"),
      description: z.string().describe("Description of the solved problem"),
      appType: z.string().describe("Application type (e.g., 'web', 'cli')"),
      details: z.string().describe("Full markdown content for the version"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Tags for the solved problem"),
      serverDependencies: z
        .array(
          z.object({
            name: z.string(),
            version: z.string(),
            packageManager: z.string(),
          }),
        )
        .optional()
        .describe("Server-side dependencies"),
      clientDependencies: z
        .array(
          z.object({
            name: z.string(),
            version: z.string(),
            packageManager: z.string(),
          }),
        )
        .optional()
        .describe("Client-side dependencies"),
    },
    async (params) => {
      const ctx = getMcpContext();

      // If updating an existing solved problem, verify access
      // If the solved problem doesn't exist or isn't accessible, treat as a new proposal
      let solvedProblemId: string | null = null;
      if (params.id) {
        const accessibleIds = await getAccessibleSolvedProblemIds(ctx.apiKeyId);
        if (accessibleIds.includes(params.id)) {
          solvedProblemId = params.id;
        }
      }

      const proposedData = {
        name: params.name,
        description: params.description,
        appType: params.appType,
        details: params.details,
        tags: params.tags ?? [],
        serverDependencies: params.serverDependencies ?? [],
        clientDependencies: params.clientDependencies ?? [],
      };

      const draft = await prisma.draft.create({
        data: {
          solvedProblemId,
          proposedData,
          status: "PENDING",
          createdByUserId: ctx.userId,
          apiKeyId: ctx.apiKeyId,
        },
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              draftId: draft.id,
              status: draft.status,
              message: solvedProblemId
                ? `Draft update proposal created for solved problem "${solvedProblemId}"`
                : "Draft new solved problem proposal created",
            }),
          },
        ],
      };
    },
  );

  return mcpServer;
}
