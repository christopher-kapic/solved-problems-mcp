import { ORPCError } from "@orpc/server";
import { z } from "zod";

import prisma from "@solved-problems/db";

import { protectedProcedure } from "../index";

/**
 * Check if a user has access to a solved problem (owner or shared).
 */
async function checkAccess(
  solvedProblemId: string,
  userId: string
): Promise<boolean> {
  // Check ownership
  const sp = await prisma.solvedProblem.findUnique({
    where: { id: solvedProblemId },
    select: { ownerId: true },
  });
  if (!sp) return false;
  if (sp.ownerId === userId) return true;

  // Check direct share
  const directShare = await prisma.share.findFirst({
    where: {
      resourceType: "SOLVED_PROBLEM",
      resourceId: solvedProblemId,
      sharedWithUserId: userId,
    },
  });
  if (directShare) return true;

  // Check group share
  const groupShare = await prisma.groupMembership.findFirst({
    where: {
      solvedProblemId,
      group: {
        id: {
          in: (
            await prisma.share.findMany({
              where: {
                sharedWithUserId: userId,
                resourceType: "GROUP",
              },
              select: { resourceId: true },
            })
          ).map((s) => s.resourceId),
        },
      },
    },
  });
  return !!groupShare;
}

export const versionsRouter = {
  list: protectedProcedure
    .input(z.object({ solvedProblemId: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const hasAccess = await checkAccess(input.solvedProblemId, userId);

      if (!hasAccess) {
        throw new ORPCError("NOT_FOUND", {
          message: "Solved problem not found",
        });
      }

      const versions = await prisma.solvedProblemVersion.findMany({
        where: { solvedProblemId: input.solvedProblemId },
        select: {
          id: true,
          version: true,
          createdAt: true,
        },
        orderBy: { version: "desc" },
      });

      return versions;
    }),

  get: protectedProcedure
    .input(
      z.object({
        solvedProblemId: z.string().min(1),
        version: z.number().int().positive(),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const hasAccess = await checkAccess(input.solvedProblemId, userId);

      if (!hasAccess) {
        throw new ORPCError("NOT_FOUND", {
          message: "Solved problem not found",
        });
      }

      const version = await prisma.solvedProblemVersion.findUnique({
        where: {
          solvedProblemId_version: {
            solvedProblemId: input.solvedProblemId,
            version: input.version,
          },
        },
      });

      if (!version) {
        throw new ORPCError("NOT_FOUND", {
          message: "Version not found",
        });
      }

      return version;
    }),
};
