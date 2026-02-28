import prisma from "@solved-problems/db";
import { env } from "@solved-problems/env/server";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  trustedOrigins: env.CORS_ORIGIN ? [env.CORS_ORIGIN] : undefined,
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "USER",
        input: false,
      },
    },
  },
  ...(env.CORS_ORIGIN
    ? {
        advanced: {
          defaultCookieAttributes: {
            sameSite: "none" as const,
            secure: true,
            httpOnly: true,
          },
        },
      }
    : {}),
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const userCount = await prisma.user.count({ take: 1 });

          if (userCount === 0) {
            return {
              data: {
                ...user,
                role: "ADMIN",
              },
            };
          }

          const settings = await prisma.siteSettings.findUnique({
            where: { id: "default" },
          });
          if (settings && !settings.signupEnabled) {
            return false;
          }

          return { data: { ...user, role: "USER" } };
        },
      },
    },
  },
  plugins: [
    twoFactor({
      skipVerificationOnEnable: false,
    }),
  ],
});
