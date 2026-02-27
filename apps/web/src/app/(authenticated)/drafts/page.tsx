"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DraftsPage() {
  const query = useQuery(orpc.drafts.list.queryOptions({}));
  const drafts = query.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Drafts</h1>
        <p className="mt-1 text-muted-foreground">
          Review drafts proposed by AI agents.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pending Drafts</CardTitle>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : drafts.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No pending drafts. Drafts will appear here when AI agents
                propose new solved problems or updates via the MCP server.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {drafts.map((draft) => (
                <Link
                  key={draft.id}
                  href={`/drafts/${draft.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {(draft.proposedData as { name?: string })?.name ??
                          "Untitled Draft"}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
                          draft.solvedProblemId
                            ? "border-blue-500/30 text-blue-600"
                            : "border-green-500/30 text-green-600"
                        }`}
                      >
                        {draft.solvedProblemId ? "Update" : "New"}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {new Date(draft.createdAt).toLocaleDateString()}
                      </span>
                      {draft.solvedProblem && (
                        <span>
                          for{" "}
                          <span className="font-medium">
                            {draft.solvedProblem.name}
                          </span>
                        </span>
                      )}
                      {draft.apiKey && (
                        <span>
                          via key{" "}
                          <span className="font-medium">
                            {draft.apiKey.name}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Review →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
