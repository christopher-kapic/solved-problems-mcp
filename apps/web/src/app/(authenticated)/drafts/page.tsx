"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DraftsPage() {
  const queryClient = useQueryClient();
  const query = useQuery(orpc.drafts.list.queryOptions({}));
  const drafts = query.data ?? [];
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const approveManyMutation = useMutation({
    ...orpc.drafts.approveMany.mutationOptions(),
    onSuccess: (data) => {
      toast.success(`Approved ${data.approved} draft(s)`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === drafts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(drafts.map((d) => d.id)));
    }
  };

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-sm">Pending Drafts</CardTitle>
              {drafts.length > 0 && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={drafts.length > 0 && selectedIds.size === drafts.length}
                    onCheckedChange={toggleAll}
                  />
                  Select all
                </label>
              )}
            </div>
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                onClick={() =>
                  approveManyMutation.mutate({ ids: Array.from(selectedIds) })
                }
                disabled={approveManyMutation.isPending}
              >
                {approveManyMutation.isPending
                  ? "Approving..."
                  : `Approve Selected (${selectedIds.size})`}
              </Button>
            )}
          </div>
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
                <div
                  key={draft.id}
                  className="flex items-center gap-3 rounded-md border px-3 py-2 transition-colors hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedIds.has(draft.id)}
                    onCheckedChange={() => toggleId(draft.id)}
                  />
                  <Link
                    href={`/drafts/${draft.id}`}
                    className="flex flex-1 items-center justify-between gap-3 min-w-0"
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
