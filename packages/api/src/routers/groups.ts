import { ORPCError } from "@orpc/server";
import { z } from "zod";

import prisma from "@solved-problems/db";

import { protectedProcedure } from "../index";

/**
 * Build accessible where clause for groups - resolves share IDs first.
 */
async function buildGroupAccessibleWhere(userId: string) {
  const groupShares = await prisma.share.findMany({
    where: {
      sharedWithUserId: userId,
      resourceType: "GROUP",
    },
    select: { resourceId: true },
  });

  const sharedGroupIds = groupShares.map((s) => s.resourceId);

  return {
    OR: [
      { ownerId: userId },
      ...(sharedGroupIds.length > 0
        ? [{ id: { in: sharedGroupIds } }]
        : []),
    ],
  };
}

export const groupsRouter = {
  list: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    const accessWhere = await buildGroupAccessibleWhere(userId);

    const groups = await prisma.solvedProblemGroup.findMany({
      where: accessWhere,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { memberships: true } },
      },
      orderBy: { name: "asc" },
    });

    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      ownerId: g.ownerId,
      owner: g.owner,
      solvedProblemCount: g._count.memberships,
    }));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const accessWhere = await buildGroupAccessibleWhere(userId);

      const group = await prisma.solvedProblemGroup.findFirst({
        where: {
          id: input.id,
          ...accessWhere,
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          memberships: {
            include: {
              solvedProblem: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  appType: true,
                },
              },
            },
          },
        },
      });

      if (!group) {
        throw new ORPCError("NOT_FOUND", {
          message: "Group not found",
        });
      }

      return {
        id: group.id,
        name: group.name,
        ownerId: group.ownerId,
        owner: group.owner,
        solvedProblems: group.memberships.map((m) => m.solvedProblem),
      };
    }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const group = await prisma.solvedProblemGroup.create({
        data: {
          name: input.name,
          ownerId: userId,
        },
      });

      return group;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const group = await prisma.solvedProblemGroup.findUnique({
        where: { id: input.id },
      });

      if (!group) {
        throw new ORPCError("NOT_FOUND", {
          message: "Group not found",
        });
      }

      if (group.ownerId !== userId) {
        throw new ORPCError("FORBIDDEN", {
          message: "Only the owner can rename a group",
        });
      }

      const updated = await prisma.solvedProblemGroup.update({
        where: { id: input.id },
        data: { name: input.name },
      });

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const group = await prisma.solvedProblemGroup.findUnique({
        where: { id: input.id },
      });

      if (!group) {
        throw new ORPCError("NOT_FOUND", {
          message: "Group not found",
        });
      }

      if (group.ownerId !== userId) {
        throw new ORPCError("FORBIDDEN", {
          message: "Only the owner can delete a group",
        });
      }

      await prisma.solvedProblemGroup.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  addSolvedProblem: protectedProcedure
    .input(
      z.object({
        groupId: z.string().min(1),
        solvedProblemId: z.string().min(1),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const group = await prisma.solvedProblemGroup.findUnique({
        where: { id: input.groupId },
      });

      if (!group) {
        throw new ORPCError("NOT_FOUND", {
          message: "Group not found",
        });
      }

      if (group.ownerId !== userId) {
        throw new ORPCError("FORBIDDEN", {
          message: "Only the owner can add solved problems to a group",
        });
      }

      // Verify solved problem exists
      const solvedProblem = await prisma.solvedProblem.findUnique({
        where: { id: input.solvedProblemId },
      });

      if (!solvedProblem) {
        throw new ORPCError("NOT_FOUND", {
          message: "Solved problem not found",
        });
      }

      await prisma.groupMembership.create({
        data: {
          groupId: input.groupId,
          solvedProblemId: input.solvedProblemId,
        },
      });

      return { success: true };
    }),

  removeSolvedProblem: protectedProcedure
    .input(
      z.object({
        groupId: z.string().min(1),
        solvedProblemId: z.string().min(1),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const group = await prisma.solvedProblemGroup.findUnique({
        where: { id: input.groupId },
      });

      if (!group) {
        throw new ORPCError("NOT_FOUND", {
          message: "Group not found",
        });
      }

      if (group.ownerId !== userId) {
        throw new ORPCError("FORBIDDEN", {
          message: "Only the owner can remove solved problems from a group",
        });
      }

      await prisma.groupMembership.delete({
        where: {
          groupId_solvedProblemId: {
            groupId: input.groupId,
            solvedProblemId: input.solvedProblemId,
          },
        },
      });

      return { success: true };
    }),
};
