import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { adminRouter } from "./admin";
import { apiKeysRouter } from "./api-keys";
import { draftsRouter } from "./drafts";
import { groupsRouter } from "./groups";
import { sharingRouter } from "./sharing";
import { solvedProblemsRouter } from "./solved-problems";
import { versionsRouter } from "./versions";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),
  solvedProblems: solvedProblemsRouter,
  versions: versionsRouter,
  groups: groupsRouter,
  sharing: sharingRouter,
  apiKeys: apiKeysRouter,
  drafts: draftsRouter,
  admin: adminRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
