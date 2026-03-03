import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import prisma from "@solved-problems/db";
import { env } from "@solved-problems/env/server";
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
  const apiKey = await prisma.apiKey.findUnique({
    where: { id: apiKeyId },
    select: { everything: true },
  });

  if (apiKey?.everything) {
    const allProblems = await prisma.solvedProblem.findMany({
      select: { id: true },
    });
    return allProblems.map((sp) => sp.id);
  }

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

interface SolvedProblemSummary {
  id: string;
  name: string;
  description: string;
  appType: string;
  updatedAt: string;
}

interface SubSolution {
  id: string;
  description: string;
}

interface FolderResult {
  id: string;
  name?: string;
  description?: string;
  appType?: string;
  updatedAt?: string;
  subSolutions: SubSolution[];
}

/**
 * Group solved problems into a hierarchical structure using `/` as delimiter.
 *
 * When not expanded: folders show one level of children (intermediate nodes).
 * When expanded: folders show all leaf-level children.
 */
function groupSolvedProblems(
  problems: SolvedProblemSummary[],
  expand: boolean,
): Array<SolvedProblemSummary | FolderResult> {
  // Separate root-level items from nested items
  const rootItems: SolvedProblemSummary[] = [];
  const nestedByPrefix = new Map<string, SolvedProblemSummary[]>();

  for (const sp of problems) {
    const slashIndex = sp.id.indexOf("/");
    if (slashIndex === -1) {
      rootItems.push(sp);
    } else {
      const topLevel = sp.id.substring(0, slashIndex);
      if (!nestedByPrefix.has(topLevel)) {
        nestedByPrefix.set(topLevel, []);
      }
      nestedByPrefix.get(topLevel)!.push(sp);
    }
  }

  const results: Array<SolvedProblemSummary | FolderResult> = [];

  // Track which root items are also folders
  const rootItemMap = new Map(rootItems.map((item) => [item.id, item]));

  // Process folders first (root items that are also folder prefixes)
  const processedRootIds = new Set<string>();

  for (const [prefix, children] of nestedByPrefix) {
    const rootItem = rootItemMap.get(prefix);
    if (rootItem) {
      processedRootIds.add(prefix);
    }

    const folder: FolderResult = {
      id: prefix,
      ...(rootItem
        ? {
            name: rootItem.name,
            description: rootItem.description,
            appType: rootItem.appType,
            updatedAt: rootItem.updatedAt,
          }
        : {}),
      subSolutions: formatSubSolutions(prefix, children, expand),
    };

    results.push(folder);
  }

  // Add remaining root items that are not folders
  for (const item of rootItems) {
    if (!processedRootIds.has(item.id)) {
      results.push(item);
    }
  }

  return results;
}

/**
 * Format sub-solutions for a folder.
 * When expanded: return all leaf children with their full IDs.
 * When collapsed: return unique next-level children (one level deep).
 */
function formatSubSolutions(
  prefix: string,
  children: SolvedProblemSummary[],
  expand: boolean,
): SubSolution[] {
  if (expand) {
    return children.map((c) => ({ id: c.id, description: c.description }));
  }

  // Collapse to one level deep
  const seen = new Map<string, SubSolution>();
  for (const child of children) {
    const rest = child.id.substring(prefix.length + 1);
    const nextSlash = rest.indexOf("/");
    const nextLevel = nextSlash === -1 ? rest : rest.substring(0, nextSlash);
    const subId = `${prefix}/${nextLevel}`;
    if (!seen.has(subId)) {
      // For intermediate nodes (those with further nesting), use a summary description
      const isLeaf = nextSlash === -1;
      seen.set(subId, {
        id: subId,
        description: isLeaf
          ? child.description
          : `Folder containing sub-solutions (use get_solved_problems with this ID to explore)`,
      });
    }
  }
  return Array.from(seen.values());
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
    `List solved problems accessible to this API key. Returns a hierarchical view using "/" as a folder delimiter.

By default, results are collapsed: top-level solved problems are shown directly, while nested ones (e.g. "web-middleware/hono/nextjs") are grouped under their top-level folder with one level of sub-solutions visible. Pass expand=true to see all leaf-level sub-solutions within each folder.

Use the "folder" parameter to list contents of a specific folder prefix (e.g. "web-middleware/hono"), which always returns fully expanded results.

Supports filtering by server/client dependencies, tags (case-insensitive), and date range (updatedBefore/updatedAfter in ISO 8601 format).`,
    {
      expand: z
        .boolean()
        .optional()
        .describe(
          "If true, show all leaf-level sub-solutions within folders. If false (default), show only one level of nesting. Defaults to the server's MCP_LIST_EXPAND_DEFAULT environment variable.",
        ),
      folder: z
        .string()
        .optional()
        .describe(
          "A folder prefix to list contents of (e.g. 'web-middleware' or 'web-middleware/hono'). Returns all sub-solutions within this folder, always fully expanded.",
        ),
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
        .describe("Filter by tag names (case-insensitive)"),
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

      // If querying a specific folder, filter IDs to those under the folder prefix
      let filteredAccessibleIds = accessibleIds;
      if (params.folder) {
        const folderPrefix = params.folder.endsWith("/")
          ? params.folder
          : `${params.folder}/`;
        filteredAccessibleIds = accessibleIds.filter(
          (id) => id.startsWith(folderPrefix) || id === params.folder,
        );

        if (filteredAccessibleIds.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify([]),
              },
            ],
          };
        }
      }

      const where: Record<string, unknown> = {
        AND: [
          { id: { in: filteredAccessibleIds } },
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

      const flat = solvedProblems.map((sp) => ({
        id: sp.id,
        name: sp.name,
        description: sp.description,
        appType: sp.appType,
        updatedAt: sp.updatedAt.toISOString(),
      }));

      // If querying a folder, always return expanded; otherwise respect the expand param
      const shouldExpand =
        params.folder !== undefined
          ? true
          : (params.expand ?? env.MCP_LIST_EXPAND_DEFAULT);
      const results = groupSolvedProblems(flat, shouldExpand);

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
    `Get full details of one or more solved problems by their IDs. Returns all fields including the latest version content (markdown), tags, and dependencies.

IDs use "/" as a folder delimiter (e.g. "web-middleware/hono/nextjs"). If you pass a folder prefix (e.g. "web-middleware/hono") that doesn't match an exact solved problem, it returns a list of all sub-solutions under that prefix so you can find the most relevant one.

Only returns data for solved problems your API key has access to. Inaccessible IDs are silently omitted.`,
    {
      ids: z
        .array(z.string())
        .describe(
          "IDs of solved problems to retrieve. Can also be folder prefixes to list sub-solutions.",
        ),
    },
    async (params) => {
      const ctx = getMcpContext();
      const accessibleIds = await getAccessibleSolvedProblemIds(ctx.apiKeyId);

      // Separate exact matches from potential folder prefixes
      const exactIds: string[] = [];
      const folderPrefixes: string[] = [];

      for (const id of params.ids) {
        if (accessibleIds.includes(id)) {
          exactIds.push(id);
        } else {
          // Check if it's a folder prefix
          const prefix = id.endsWith("/") ? id : `${id}/`;
          const children = accessibleIds.filter((aid) =>
            aid.startsWith(prefix),
          );
          if (children.length > 0) {
            folderPrefixes.push(id);
          }
        }
      }

      const results: unknown[] = [];

      // Fetch exact matches with full details
      if (exactIds.length > 0) {
        const solvedProblems = await prisma.solvedProblem.findMany({
          where: { id: { in: exactIds } },
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

        for (const sp of solvedProblems) {
          results.push({
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
          });
        }
      }

      // Resolve folder prefixes to sub-solution listings
      for (const prefix of folderPrefixes) {
        const normalizedPrefix = prefix.endsWith("/")
          ? prefix
          : `${prefix}/`;
        const childIds = accessibleIds.filter((id) =>
          id.startsWith(normalizedPrefix),
        );

        const children = await prisma.solvedProblem.findMany({
          where: { id: { in: childIds } },
          select: {
            id: true,
            name: true,
            description: true,
            appType: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
        });

        results.push({
          id: prefix,
          type: "folder",
          subSolutions: children.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            appType: c.appType,
            updatedAt: c.updatedAt.toISOString(),
          })),
        });
      }

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
    `Propose a new solved problem or an update to an existing one. Creates a Draft record with PENDING status for the owner to review and approve in the web UI.

For updates: pass the "id" of the existing solved problem. You can optionally propose renaming it by passing "newId" — this is useful when reorganizing solved problems into folders (e.g. renaming "astro-hono-middleware" to "web-middleware/hono/astro"). The newId must use only lowercase letters, numbers, hyphens, and "/" for folder nesting.

For new proposals: omit "id" and provide all required fields. The owner will choose the final ID when approving.

All fields (name, description, appType, details) are required. Tags and dependencies are optional.`,
    {
      id: z
        .string()
        .optional()
        .describe(
          "ID of an existing solved problem to propose an update to. Omit when proposing a brand new solved problem.",
        ),
      newId: z
        .string()
        .optional()
        .describe(
          "Proposed new ID for the solved problem (only for updates). Use this to rename or reorganize into folders. Must contain only lowercase letters, numbers, hyphens, and '/' for folder nesting (e.g. 'web-middleware/hono/astro').",
        ),
      name: z.string().describe("Human-readable name of the solved problem"),
      description: z
        .string()
        .describe(
          "Brief description of what this solved problem covers and when to use it",
        ),
      appType: z
        .string()
        .describe("Application type (e.g. 'web', 'cli', 'library', 'api')"),
      details: z
        .string()
        .describe(
          "Full markdown content describing the solution, including code examples, configuration, and step-by-step instructions",
        ),
      tags: z
        .array(z.string())
        .optional()
        .describe(
          "Tags for categorization and discovery (e.g. ['nextjs', 'hono', 'middleware'])",
        ),
      serverDependencies: z
        .array(
          z.object({
            name: z.string(),
            version: z.string(),
            packageManager: z.string(),
          }),
        )
        .optional()
        .describe(
          "Server-side dependencies required by this solution (e.g. [{name: 'hono', version: '^4.0.0', packageManager: 'npm'}])",
        ),
      clientDependencies: z
        .array(
          z.object({
            name: z.string(),
            version: z.string(),
            packageManager: z.string(),
          }),
        )
        .optional()
        .describe(
          "Client-side dependencies required by this solution",
        ),
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

      // Validate newId format if provided
      if (params.newId && !/^[a-z0-9]+(?:[-/][a-z0-9]+)*$/.test(params.newId)) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error:
                  "Invalid newId format. Must contain only lowercase letters, numbers, hyphens, and '/' for folder nesting. Cannot start or end with '-' or '/'.",
              }),
            },
          ],
        };
      }

      // newId only makes sense for updates
      if (params.newId && !solvedProblemId) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error:
                  "newId can only be used when updating an existing solved problem (provide a valid 'id').",
              }),
            },
          ],
        };
      }

      const proposedData = {
        name: params.name,
        description: params.description,
        appType: params.appType,
        details: params.details,
        tags: params.tags ?? [],
        serverDependencies: params.serverDependencies ?? [],
        clientDependencies: params.clientDependencies ?? [],
        ...(params.newId ? { newId: params.newId } : {}),
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
                ? `Draft update proposal created for solved problem "${solvedProblemId}"${params.newId ? ` (proposing rename to "${params.newId}")` : ""}`
                : "Draft new solved problem proposal created",
            }),
          },
        ],
      };
    },
  );

  return mcpServer;
}
