import { ORPCError } from "@orpc/server";
import { z } from "zod";

import prisma from "@solved-problems/db";

import { protectedProcedure } from "../index";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const dependencySchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  packageManager: z.string().min(1),
  type: z.enum(["SERVER", "CLIENT"]),
});

/**
 * Build accessible where clause by resolving share IDs first,
 * so we can use them in Prisma queries properly.
 */
async function buildAccessibleWhere(userId: string) {
  const [directShares, groupShares] = await Promise.all([
    prisma.share.findMany({
      where: {
        sharedWithUserId: userId,
        resourceType: "SOLVED_PROBLEM",
      },
      select: { resourceId: true },
    }),
    prisma.share.findMany({
      where: {
        sharedWithUserId: userId,
        resourceType: "GROUP",
      },
      select: { resourceId: true },
    }),
  ]);

  const directIds = directShares.map((s) => s.resourceId);
  const groupIds = groupShares.map((s) => s.resourceId);

  return {
    OR: [
      { ownerId: userId },
      ...(directIds.length > 0 ? [{ id: { in: directIds } }] : []),
      ...(groupIds.length > 0
        ? [
            {
              groupMemberships: {
                some: {
                  groupId: { in: groupIds },
                },
              },
            },
          ]
        : []),
    ],
  };
}

export const solvedProblemsRouter = {
  list: protectedProcedure
    .input(
      z.object({
        tags: z.array(z.string()).optional(),
        serverDependencies: z.array(z.string()).optional(),
        clientDependencies: z.array(z.string()).optional(),
        appType: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const accessWhere = await buildAccessibleWhere(userId);

      const where: Record<string, unknown> = {
        AND: [
          accessWhere,
          ...(input.search
            ? [
                {
                  OR: [
                    {
                      name: {
                        contains: input.search,
                        mode: "insensitive" as const,
                      },
                    },
                    {
                      description: {
                        contains: input.search,
                        mode: "insensitive" as const,
                      },
                    },
                  ],
                },
              ]
            : []),
          ...(input.appType ? [{ appType: input.appType }] : []),
          ...(input.tags && input.tags.length > 0
            ? [
                {
                  tags: {
                    some: {
                      tag: {
                        name: {
                          in: input.tags,
                          mode: "insensitive" as const,
                        },
                      },
                    },
                  },
                },
              ]
            : []),
          ...(input.serverDependencies && input.serverDependencies.length > 0
            ? [
                {
                  dependencies: {
                    some: {
                      type: "SERVER" as const,
                      name: {
                        in: input.serverDependencies,
                        mode: "insensitive" as const,
                      },
                    },
                  },
                },
              ]
            : []),
          ...(input.clientDependencies && input.clientDependencies.length > 0
            ? [
                {
                  dependencies: {
                    some: {
                      type: "CLIENT" as const,
                      name: {
                        in: input.clientDependencies,
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
          tags: {
            include: { tag: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      return solvedProblems.map((sp) => ({
        ...sp,
        tags: sp.tags.map((t) => t.tag),
      }));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const accessWhere = await buildAccessibleWhere(userId);

      const solvedProblem = await prisma.solvedProblem.findFirst({
        where: {
          id: input.id,
          ...accessWhere,
        },
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1,
          },
          tags: {
            include: { tag: true },
          },
          dependencies: true,
          owner: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (!solvedProblem) {
        throw new ORPCError("NOT_FOUND", {
          message: "Solved problem not found",
        });
      }

      return {
        ...solvedProblem,
        latestVersion: solvedProblem.versions[0] ?? null,
        tags: solvedProblem.tags.map((t) => t.tag),
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string(),
        appType: z.string().min(1),
        tags: z.array(z.string()).optional(),
        dependencies: z.array(dependencySchema).optional(),
        details: z.string().optional(),
        copiedFromId: z.string().optional(),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      let id = slugify(input.name);

      // Ensure unique slug
      const existing = await prisma.solvedProblem.findUnique({
        where: { id },
      });
      if (existing) {
        id = `${id}-${Date.now()}`;
      }

      // Upsert tags
      const tagRecords = input.tags?.length
        ? await Promise.all(
            input.tags.map((name) =>
              prisma.tag.upsert({
                where: { name },
                create: { name },
                update: {},
              })
            )
          )
        : [];

      const solvedProblem = await prisma.solvedProblem.create({
        data: {
          id,
          name: input.name,
          description: input.description,
          appType: input.appType,
          ownerId: userId,
          copiedFromId: input.copiedFromId,
          versions: input.details
            ? {
                create: {
                  version: 1,
                  details: input.details,
                },
              }
            : undefined,
          tags: tagRecords.length
            ? {
                create: tagRecords.map((tag) => ({
                  tagId: tag.id,
                })),
              }
            : undefined,
          dependencies: input.dependencies?.length
            ? {
                create: input.dependencies.map((dep) => ({
                  name: dep.name,
                  version: dep.version,
                  packageManager: dep.packageManager,
                  type: dep.type,
                })),
              }
            : undefined,
        },
        include: {
          versions: true,
          tags: { include: { tag: true } },
          dependencies: true,
        },
      });

      return solvedProblem;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        appType: z.string().optional(),
        tags: z.array(z.string()).optional(),
        dependencies: z.array(dependencySchema).optional(),
        details: z.string().optional(),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // Check ownership or write access
      const solvedProblem = await prisma.solvedProblem.findUnique({
        where: { id: input.id },
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1,
          },
        },
      });

      if (!solvedProblem) {
        throw new ORPCError("NOT_FOUND", {
          message: "Solved problem not found",
        });
      }

      if (solvedProblem.ownerId !== userId) {
        const share = await prisma.share.findFirst({
          where: {
            resourceType: "SOLVED_PROBLEM",
            resourceId: input.id,
            sharedWithUserId: userId,
            permission: "WRITE",
          },
        });
        if (!share) {
          throw new ORPCError("FORBIDDEN", {
            message: "You don't have permission to update this solved problem",
          });
        }
      }

      // Create new version if details changed
      const latestVersion = solvedProblem.versions[0];
      if (
        input.details !== undefined &&
        input.details !== (latestVersion?.details ?? "")
      ) {
        const nextVersion = (latestVersion?.version ?? 0) + 1;
        await prisma.solvedProblemVersion.create({
          data: {
            solvedProblemId: input.id,
            version: nextVersion,
            details: input.details,
          },
        });
      }

      // Update tags if provided
      if (input.tags !== undefined) {
        // Remove existing tags
        await prisma.solvedProblemTag.deleteMany({
          where: { solvedProblemId: input.id },
        });

        if (input.tags.length > 0) {
          const tagRecords = await Promise.all(
            input.tags.map((name) =>
              prisma.tag.upsert({
                where: { name },
                create: { name },
                update: {},
              })
            )
          );
          await prisma.solvedProblemTag.createMany({
            data: tagRecords.map((tag) => ({
              solvedProblemId: input.id,
              tagId: tag.id,
            })),
          });
        }
      }

      // Update dependencies if provided
      if (input.dependencies !== undefined) {
        await prisma.dependency.deleteMany({
          where: { solvedProblemId: input.id },
        });

        if (input.dependencies.length > 0) {
          await prisma.dependency.createMany({
            data: input.dependencies.map((dep) => ({
              name: dep.name,
              version: dep.version,
              packageManager: dep.packageManager,
              type: dep.type,
              solvedProblemId: input.id,
            })),
          });
        }
      }

      // Update core fields
      const updated = await prisma.solvedProblem.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.appType !== undefined ? { appType: input.appType } : {}),
        },
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1,
          },
          tags: { include: { tag: true } },
          dependencies: true,
        },
      });

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const solvedProblem = await prisma.solvedProblem.findUnique({
        where: { id: input.id },
      });

      if (!solvedProblem) {
        throw new ORPCError("NOT_FOUND", {
          message: "Solved problem not found",
        });
      }

      if (solvedProblem.ownerId !== userId) {
        throw new ORPCError("FORBIDDEN", {
          message: "Only the owner can delete a solved problem",
        });
      }

      await prisma.solvedProblem.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
};
