import { createHash, randomBytes } from "node:crypto";

import { ORPCError } from "@orpc/server";
import { z } from "zod";

import prisma from "@solved-problems/db";

import { protectedProcedure } from "../index";

const resourceTypeSchema = z.enum(["SOLVED_PROBLEM", "GROUP"]);

const accessScopeSchema = z.object({
  resourceType: resourceTypeSchema,
  resourceId: z.string().min(1),
});

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export const apiKeysRouter = {
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        accesses: z.array(accessScopeSchema),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // Generate a secure random API key
      const plainKey = `sp_${randomBytes(32).toString("hex")}`;
      const hashedKey = hashKey(plainKey);

      const apiKey = await prisma.apiKey.create({
        data: {
          name: input.name,
          hashedKey,
          userId,
          accesses: {
            create: input.accesses.map((a) => ({
              resourceType: a.resourceType,
              resourceId: a.resourceId,
            })),
          },
        },
        include: {
          accesses: {
            select: {
              id: true,
              resourceType: true,
              resourceId: true,
            },
          },
        },
      });

      return {
        id: apiKey.id,
        name: apiKey.name,
        key: plainKey,
        createdAt: apiKey.createdAt,
        accesses: apiKey.accesses,
      };
    }),

  list: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    const keys = await prisma.apiKey.findMany({
      where: { userId },
      include: {
        accesses: {
          select: {
            id: true,
            resourceType: true,
            resourceId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      createdAt: k.createdAt,
      revokedAt: k.revokedAt,
      accesses: k.accesses,
    }));
  }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const apiKey = await prisma.apiKey.findUnique({
        where: { id: input.id },
        select: { userId: true, revokedAt: true },
      });

      if (!apiKey) {
        throw new ORPCError("NOT_FOUND", {
          message: "API key not found",
        });
      }

      if (apiKey.userId !== userId) {
        throw new ORPCError("FORBIDDEN", {
          message: "You can only revoke your own API keys",
        });
      }

      if (apiKey.revokedAt) {
        throw new ORPCError("BAD_REQUEST", {
          message: "API key is already revoked",
        });
      }

      await prisma.apiKey.update({
        where: { id: input.id },
        data: { revokedAt: new Date() },
      });

      return { success: true };
    }),

  updateAccess: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        accesses: z.array(accessScopeSchema),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const apiKey = await prisma.apiKey.findUnique({
        where: { id: input.id },
        select: { userId: true, revokedAt: true },
      });

      if (!apiKey) {
        throw new ORPCError("NOT_FOUND", {
          message: "API key not found",
        });
      }

      if (apiKey.userId !== userId) {
        throw new ORPCError("FORBIDDEN", {
          message: "You can only update your own API keys",
        });
      }

      if (apiKey.revokedAt) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Cannot update access for a revoked API key",
        });
      }

      // Replace all access records
      await prisma.$transaction([
        prisma.apiKeyAccess.deleteMany({
          where: { apiKeyId: input.id },
        }),
        ...input.accesses.map((a) =>
          prisma.apiKeyAccess.create({
            data: {
              apiKeyId: input.id,
              resourceType: a.resourceType,
              resourceId: a.resourceId,
            },
          })
        ),
      ]);

      const updated = await prisma.apiKey.findUnique({
        where: { id: input.id },
        include: {
          accesses: {
            select: {
              id: true,
              resourceType: true,
              resourceId: true,
            },
          },
        },
      });

      return {
        id: updated!.id,
        name: updated!.name,
        createdAt: updated!.createdAt,
        accesses: updated!.accesses,
      };
    }),
};
