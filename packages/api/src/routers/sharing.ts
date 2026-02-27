import { ORPCError } from "@orpc/server";
import { z } from "zod";

import prisma from "@solved-problems/db";

import { protectedProcedure } from "../index";

/**
 * Resolve the display name for a resource by type and ID.
 */
async function resolveResourceName(
  resourceType: "SOLVED_PROBLEM" | "GROUP",
  resourceId: string
): Promise<string> {
  if (resourceType === "SOLVED_PROBLEM") {
    const sp = await prisma.solvedProblem.findUnique({
      where: { id: resourceId },
      select: { name: true },
    });
    return sp?.name ?? resourceId;
  } else {
    const group = await prisma.solvedProblemGroup.findUnique({
      where: { id: resourceId },
      select: { name: true },
    });
    return group?.name ?? resourceId;
  }
}

/**
 * Verify that the current user is the owner of the given resource.
 */
async function verifyResourceOwner(
  resourceType: "SOLVED_PROBLEM" | "GROUP",
  resourceId: string,
  userId: string
) {
  if (resourceType === "SOLVED_PROBLEM") {
    const sp = await prisma.solvedProblem.findUnique({
      where: { id: resourceId },
      select: { ownerId: true },
    });
    if (!sp) {
      throw new ORPCError("NOT_FOUND", {
        message: "Solved problem not found",
      });
    }
    if (sp.ownerId !== userId) {
      throw new ORPCError("FORBIDDEN", {
        message: "Only the owner can manage shares for this resource",
      });
    }
  } else {
    const group = await prisma.solvedProblemGroup.findUnique({
      where: { id: resourceId },
      select: { ownerId: true },
    });
    if (!group) {
      throw new ORPCError("NOT_FOUND", {
        message: "Group not found",
      });
    }
    if (group.ownerId !== userId) {
      throw new ORPCError("FORBIDDEN", {
        message: "Only the owner can manage shares for this resource",
      });
    }
  }
}

const resourceTypeSchema = z.enum(["SOLVED_PROBLEM", "GROUP"]);
const permissionSchema = z.enum(["READ", "WRITE"]);

export const sharingRouter = {
  share: protectedProcedure
    .input(
      z.object({
        resourceType: resourceTypeSchema,
        resourceId: z.string().min(1),
        sharedWithUserId: z.string().min(1),
        permission: permissionSchema,
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      await verifyResourceOwner(input.resourceType, input.resourceId, userId);

      if (input.sharedWithUserId === userId) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Cannot share a resource with yourself",
        });
      }

      // Verify target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: input.sharedWithUserId },
        select: { id: true },
      });
      if (!targetUser) {
        throw new ORPCError("NOT_FOUND", {
          message: "User not found",
        });
      }

      // Check for existing share
      const existing = await prisma.share.findFirst({
        where: {
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          sharedWithUserId: input.sharedWithUserId,
        },
      });
      if (existing) {
        throw new ORPCError("CONFLICT", {
          message: "Resource is already shared with this user",
        });
      }

      const share = await prisma.share.create({
        data: {
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          sharedWithUserId: input.sharedWithUserId,
          permission: input.permission,
          sharedByUserId: userId,
        },
        include: {
          sharedWithUser: { select: { id: true, name: true, email: true } },
        },
      });

      return {
        id: share.id,
        resourceType: share.resourceType,
        resourceId: share.resourceId,
        permission: share.permission,
        sharedWithUser: share.sharedWithUser,
        createdAt: share.createdAt,
      };
    }),

  updatePermission: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        permission: permissionSchema,
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const share = await prisma.share.findUnique({
        where: { id: input.id },
      });

      if (!share) {
        throw new ORPCError("NOT_FOUND", {
          message: "Share not found",
        });
      }

      await verifyResourceOwner(share.resourceType, share.resourceId, userId);

      const updated = await prisma.share.update({
        where: { id: input.id },
        data: { permission: input.permission },
        include: {
          sharedWithUser: { select: { id: true, name: true, email: true } },
        },
      });

      return {
        id: updated.id,
        resourceType: updated.resourceType,
        resourceId: updated.resourceId,
        permission: updated.permission,
        sharedWithUser: updated.sharedWithUser,
        createdAt: updated.createdAt,
      };
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const share = await prisma.share.findUnique({
        where: { id: input.id },
      });

      if (!share) {
        throw new ORPCError("NOT_FOUND", {
          message: "Share not found",
        });
      }

      await verifyResourceOwner(share.resourceType, share.resourceId, userId);

      await prisma.share.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  listSharedByMe: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    const shares = await prisma.share.findMany({
      where: { sharedByUserId: userId },
      include: {
        sharedWithUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return Promise.all(
      shares.map(async (s) => ({
        id: s.id,
        resourceType: s.resourceType,
        resourceId: s.resourceId,
        resourceName: await resolveResourceName(s.resourceType, s.resourceId),
        permission: s.permission,
        sharedWithUser: s.sharedWithUser,
        createdAt: s.createdAt,
      }))
    );
  }),

  listSharedWithMe: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    const shares = await prisma.share.findMany({
      where: { sharedWithUserId: userId },
      include: {
        sharedByUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return Promise.all(
      shares.map(async (s) => ({
        id: s.id,
        resourceType: s.resourceType,
        resourceId: s.resourceId,
        resourceName: await resolveResourceName(s.resourceType, s.resourceId),
        permission: s.permission,
        sharedByUser: s.sharedByUser,
        createdAt: s.createdAt,
      }))
    );
  }),

  lookupUserByEmail: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .handler(async ({ input }) => {
      const user = await prisma.user.findFirst({
        where: { email: input.email },
        select: { id: true, name: true, email: true },
      });
      return user;
    }),
};
