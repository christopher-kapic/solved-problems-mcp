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

const proposedDataSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  appType: z.string().min(1),
  tags: z.array(z.string()).optional(),
  dependencies: z
    .array(
      z.object({
        name: z.string().min(1),
        version: z.string().min(1),
        packageManager: z.string().min(1),
        type: z.enum(["SERVER", "CLIENT"]),
      })
    )
    .optional(),
  details: z.string().optional(),
});

export const draftsRouter = {
  list: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    // Return pending drafts for solved problems the user owns,
    // or drafts created by the user (for new problem proposals where solvedProblemId is null)
    const drafts = await prisma.draft.findMany({
      where: {
        status: "PENDING",
        OR: [
          {
            solvedProblem: {
              ownerId: userId,
            },
          },
          {
            solvedProblemId: null,
            createdByUserId: userId,
          },
        ],
      },
      include: {
        solvedProblem: {
          select: { id: true, name: true },
        },
        apiKey: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return drafts;
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const draft = await prisma.draft.findUnique({
        where: { id: input.id },
        include: {
          solvedProblem: {
            include: {
              versions: {
                orderBy: { version: "desc" },
                take: 1,
              },
              tags: { include: { tag: true } },
              dependencies: true,
            },
          },
          apiKey: {
            select: { id: true, name: true },
          },
          createdByUser: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (!draft) {
        throw new ORPCError("NOT_FOUND", { message: "Draft not found" });
      }

      // Check access: user owns the target solved problem, or is the draft creator (for new proposals)
      const isOwnerOfProblem =
        draft.solvedProblem && draft.solvedProblem.ownerId === userId;
      const isCreator =
        draft.solvedProblemId === null && draft.createdByUserId === userId;

      if (!isOwnerOfProblem && !isCreator) {
        throw new ORPCError("FORBIDDEN", {
          message: "You don't have access to this draft",
        });
      }

      return draft;
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const draft = await prisma.draft.findUnique({
        where: { id: input.id },
        include: {
          solvedProblem: {
            include: {
              versions: {
                orderBy: { version: "desc" },
                take: 1,
              },
            },
          },
        },
      });

      if (!draft) {
        throw new ORPCError("NOT_FOUND", { message: "Draft not found" });
      }

      if (draft.status !== "PENDING") {
        throw new ORPCError("BAD_REQUEST", {
          message: "Draft is not pending",
        });
      }

      // Only the solved problem owner can approve (or the creator for new proposals)
      const isOwnerOfProblem =
        draft.solvedProblem && draft.solvedProblem.ownerId === userId;
      const isCreator =
        draft.solvedProblemId === null && draft.createdByUserId === userId;

      if (!isOwnerOfProblem && !isCreator) {
        throw new ORPCError("FORBIDDEN", {
          message: "Only the resource owner can approve drafts",
        });
      }

      const data = proposedDataSchema.parse(draft.proposedData);

      if (draft.solvedProblemId && draft.solvedProblem) {
        // Update existing solved problem
        const latestVersion = draft.solvedProblem.versions[0];

        // Create new version if details changed
        if (
          data.details !== undefined &&
          data.details !== (latestVersion?.details ?? "")
        ) {
          const nextVersion = (latestVersion?.version ?? 0) + 1;
          await prisma.solvedProblemVersion.create({
            data: {
              solvedProblemId: draft.solvedProblemId,
              version: nextVersion,
              details: data.details,
            },
          });
        }

        // Update tags if provided
        if (data.tags !== undefined) {
          await prisma.solvedProblemTag.deleteMany({
            where: { solvedProblemId: draft.solvedProblemId },
          });
          if (data.tags.length > 0) {
            const tagRecords = await Promise.all(
              data.tags.map((name) =>
                prisma.tag.upsert({
                  where: { name },
                  create: { name },
                  update: {},
                })
              )
            );
            await prisma.solvedProblemTag.createMany({
              data: tagRecords.map((tag) => ({
                solvedProblemId: draft.solvedProblemId!,
                tagId: tag.id,
              })),
            });
          }
        }

        // Update dependencies if provided
        if (data.dependencies !== undefined) {
          await prisma.dependency.deleteMany({
            where: { solvedProblemId: draft.solvedProblemId },
          });
          if (data.dependencies.length > 0) {
            await prisma.dependency.createMany({
              data: data.dependencies.map((dep) => ({
                name: dep.name,
                version: dep.version,
                packageManager: dep.packageManager,
                type: dep.type,
                solvedProblemId: draft.solvedProblemId!,
              })),
            });
          }
        }

        // Update core fields
        await prisma.solvedProblem.update({
          where: { id: draft.solvedProblemId },
          data: {
            name: data.name,
            description: data.description,
            appType: data.appType,
          },
        });
      } else {
        // Create new solved problem
        let id = slugify(data.name);
        const existing = await prisma.solvedProblem.findUnique({
          where: { id },
        });
        if (existing) {
          id = `${id}-${Date.now()}`;
        }

        const tagRecords = data.tags?.length
          ? await Promise.all(
              data.tags.map((name) =>
                prisma.tag.upsert({
                  where: { name },
                  create: { name },
                  update: {},
                })
              )
            )
          : [];

        await prisma.solvedProblem.create({
          data: {
            id,
            name: data.name,
            description: data.description,
            appType: data.appType,
            ownerId: userId,
            versions: data.details
              ? {
                  create: {
                    version: 1,
                    details: data.details,
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
            dependencies: data.dependencies?.length
              ? {
                  create: data.dependencies.map((dep) => ({
                    name: dep.name,
                    version: dep.version,
                    packageManager: dep.packageManager,
                    type: dep.type,
                  })),
                }
              : undefined,
          },
        });
      }

      // Mark draft as approved
      const updated = await prisma.draft.update({
        where: { id: input.id },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
        },
      });

      return updated;
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const draft = await prisma.draft.findUnique({
        where: { id: input.id },
        include: {
          solvedProblem: {
            select: { ownerId: true },
          },
        },
      });

      if (!draft) {
        throw new ORPCError("NOT_FOUND", { message: "Draft not found" });
      }

      if (draft.status !== "PENDING") {
        throw new ORPCError("BAD_REQUEST", {
          message: "Draft is not pending",
        });
      }

      const isOwnerOfProblem =
        draft.solvedProblem && draft.solvedProblem.ownerId === userId;
      const isCreator =
        draft.solvedProblemId === null && draft.createdByUserId === userId;

      if (!isOwnerOfProblem && !isCreator) {
        throw new ORPCError("FORBIDDEN", {
          message: "Only the resource owner can reject drafts",
        });
      }

      const updated = await prisma.draft.update({
        where: { id: input.id },
        data: {
          status: "REJECTED",
          reviewedAt: new Date(),
        },
      });

      return updated;
    }),

  copyToOwn: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const draft = await prisma.draft.findUnique({
        where: { id: input.id },
      });

      if (!draft) {
        throw new ORPCError("NOT_FOUND", { message: "Draft not found" });
      }

      const data = proposedDataSchema.parse(draft.proposedData);

      // Create a new solved problem owned by current user
      let id = slugify(data.name);
      const existing = await prisma.solvedProblem.findUnique({
        where: { id },
      });
      if (existing) {
        id = `${id}-${Date.now()}`;
      }

      const tagRecords = data.tags?.length
        ? await Promise.all(
            data.tags.map((name) =>
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
          name: data.name,
          description: data.description,
          appType: data.appType,
          ownerId: userId,
          copiedFromId: draft.solvedProblemId ?? undefined,
          versions: data.details
            ? {
                create: {
                  version: 1,
                  details: data.details,
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
          dependencies: data.dependencies?.length
            ? {
                create: data.dependencies.map((dep) => ({
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
};
