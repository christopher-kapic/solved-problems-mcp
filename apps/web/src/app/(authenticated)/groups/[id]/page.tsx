"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const query = useQuery(
    orpc.groups.get.queryOptions({ input: { id: params.id } })
  );

  const solvedProblemsQuery = useQuery(
    orpc.solvedProblems.list.queryOptions({ input: {} })
  );

  const deleteMutation = useMutation({
    ...orpc.groups.delete.mutationOptions(),
    onSuccess: () => {
      toast.success("Group deleted");
      queryClient.invalidateQueries();
      router.push("/groups");
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const addMutation = useMutation({
    ...orpc.groups.addSolvedProblem.mutationOptions(),
    onSuccess: () => {
      toast.success("Solved problem added to group");
      queryClient.invalidateQueries();
      setSearchTerm("");
    },
    onError: (error) => {
      toast.error(`Failed to add: ${error.message}`);
    },
  });

  const removeMutation = useMutation({
    ...orpc.groups.removeSolvedProblem.mutationOptions(),
    onSuccess: () => {
      toast.success("Solved problem removed from group");
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast.error(`Failed to remove: ${error.message}`);
    },
  });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Group not found or you don&apos;t have access.
            </p>
            <Link
              href="/groups"
              className={buttonVariants({ variant: "outline", className: "mt-4" })}
            >
              Back to Groups
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const group = query.data;
  const isOwner = session?.user?.id === group.ownerId;
  const memberIds = new Set(group.solvedProblems.map((sp) => sp.id));

  // Filter available solved problems for the add dropdown
  const availableProblems = (solvedProblemsQuery.data ?? []).filter(
    (sp) =>
      !memberIds.has(sp.id) &&
      (searchTerm === "" ||
        sp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sp.id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Owned by {group.owner.name ?? group.owner.email}
            {" · "}
            {group.solvedProblems.length} solved problem
            {group.solvedProblems.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Actions */}
      {isOwner && (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/groups/${group.id}/edit`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Edit
          </Link>
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate({ id: group.id })}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Confirm Delete"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete Group
            </Button>
          )}
        </div>
      )}

      {/* Solved Problems in Group */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Solved Problems</CardTitle>
        </CardHeader>
        <CardContent>
          {group.solvedProblems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No solved problems in this group yet.
            </p>
          ) : (
            <div className="space-y-2">
              {group.solvedProblems.map((sp) => (
                <div
                  key={sp.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <Link
                    href={`/solved-problems/${sp.id}`}
                    className="min-w-0 hover:underline"
                  >
                    <p className="text-sm font-medium">{sp.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {sp.description}
                    </p>
                  </Link>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 shrink-0 text-destructive hover:text-destructive"
                      onClick={() =>
                        removeMutation.mutate({
                          groupId: group.id,
                          solvedProblemId: sp.id,
                        })
                      }
                      disabled={removeMutation.isPending}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Solved Problem (owner only) */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Add Solved Problem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search solved problems by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {availableProblems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No matching solved problems found.
                  </p>
                ) : (
                  availableProblems.slice(0, 10).map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50"
                      onClick={() =>
                        addMutation.mutate({
                          groupId: group.id,
                          solvedProblemId: sp.id,
                        })
                      }
                      disabled={addMutation.isPending}
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{sp.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {sp.description}
                        </p>
                      </div>
                      <span className="ml-2 shrink-0 text-xs text-primary">
                        + Add
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
