import { z } from "zod";
import { ORPCError } from "@orpc/server";

import prisma from "@solved-problems/db";

import { adminProcedure } from "../index";

export const adminRouter = {
  getSettings: adminProcedure.handler(async () => {
    const settings = await prisma.siteSettings.upsert({
      where: { id: "default" },
      create: { id: "default", signupEnabled: true },
      update: {},
    });
    return settings;
  }),

  updateSettings: adminProcedure
    .input(
      z.object({
        signupEnabled: z.boolean().optional(),
      })
    )
    .handler(async ({ input }) => {
      const settings = await prisma.siteSettings.upsert({
        where: { id: "default" },
        create: {
          id: "default",
          signupEnabled: input.signupEnabled ?? true,
        },
        update: {
          ...(input.signupEnabled !== undefined && {
            signupEnabled: input.signupEnabled,
          }),
        },
      });
      return settings;
    }),

  listUsers: adminProcedure.handler(async () => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        twoFactorEnabled: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return users;
  }),

  deleteUser: adminProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .handler(async ({ input, context }) => {
      if (input.userId === context.session.user.id) {
        throw new ORPCError("BAD_REQUEST", {
          message: "You cannot delete yourself.",
        });
      }

      await prisma.user.delete({
        where: { id: input.userId },
      });

      return { success: true };
    }),

  disableTwoFactor: adminProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .handler(async ({ input, context }) => {
      if (input.userId === context.session.user.id) {
        throw new ORPCError("BAD_REQUEST", {
          message: "You cannot disable 2FA for yourself.",
        });
      }

      await prisma.twoFactor.delete({
        where: { userId: input.userId },
      });

      await prisma.user.update({
        where: { id: input.userId },
        data: { twoFactorEnabled: false },
      });

      return { success: true };
    }),
};
