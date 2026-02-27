"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ResourceSelector, type AccessScope } from "@/components/resource-selector";

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const query = useQuery(orpc.apiKeys.list.queryOptions({}));
  const keys = query.data ?? [];

  const [editingKey, setEditingKey] = useState<{
    id: string;
    name: string;
    accesses: AccessScope[];
  } | null>(null);
  const [editAccesses, setEditAccesses] = useState<AccessScope[]>([]);

  const revokeMutation = useMutation({
    ...orpc.apiKeys.revoke.mutationOptions(),
    onSuccess: () => {
      toast.success("API key revoked");
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast.error(`Failed to revoke: ${error.message}`);
    },
  });

  const updateAccessMutation = useMutation({
    ...orpc.apiKeys.updateAccess.mutationOptions(),
    onSuccess: () => {
      toast.success("Access updated");
      queryClient.invalidateQueries();
      setEditingKey(null);
    },
    onError: (error) => {
      toast.error(`Failed to update access: ${error.message}`);
    },
  });

  const openEditSheet = (key: {
    id: string;
    name: string;
    accesses: { id: string; resourceType: string; resourceId: string }[];
  }) => {
    const mapped = key.accesses.map((a) => ({
      resourceType: a.resourceType as AccessScope["resourceType"],
      resourceId: a.resourceId,
    }));
    setEditAccesses(mapped);
    setEditingKey({ id: key.id, name: key.name, accesses: mapped });
  };

  const handleSaveAccess = () => {
    if (!editingKey) return;
    updateAccessMutation.mutate({
      id: editingKey.id,
      accesses: editAccesses,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="mt-1 text-muted-foreground">
            Manage API keys for MCP access.
          </p>
        </div>
        <Link
          href="/api-keys/new"
          className={buttonVariants()}
        >
          New API Key
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Your API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : keys.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                You don&apos;t have any API keys yet.
              </p>
              <Link
                href="/api-keys/new"
                className={buttonVariants({ variant: "outline", className: "mt-3" })}
              >
                Create your first API key
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {keys.map((key) => {
                const isRevoked = key.revokedAt !== null;
                return (
                  <div
                    key={key.id}
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{key.name}</p>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
                            isRevoked
                              ? "border-destructive/30 text-destructive"
                              : "border-green-500/30 text-green-600"
                          }`}
                        >
                          {isRevoked ? "Revoked" : "Active"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Created {new Date(key.createdAt).toLocaleDateString()}
                      </p>
                      {key.accesses.length > 0 ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Access:{" "}
                          {key.accesses.map((a) => (
                            <span
                              key={a.id}
                              className="mr-1 inline-block rounded bg-muted px-1.5 py-0.5"
                            >
                              {a.resourceType === "SOLVED_PROBLEM"
                                ? "Problem"
                                : "Group"}
                              : {a.resourceId}
                            </span>
                          ))}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          No resource access
                        </p>
                      )}
                    </div>
                    {!isRevoked && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditSheet(key)}
                        >
                          Edit Access
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => revokeMutation.mutate({ id: key.id })}
                          disabled={revokeMutation.isPending}
                        >
                          Revoke
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={editingKey !== null} onOpenChange={(open) => !open && setEditingKey(null)}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Edit Access</SheetTitle>
            <SheetDescription>
              Update resource access for &ldquo;{editingKey?.name}&rdquo;.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6 px-4">
            <ResourceSelector accesses={editAccesses} onChange={setEditAccesses} />
            <div className="flex gap-3">
              <Button
                onClick={handleSaveAccess}
                disabled={updateAccessMutation.isPending}
              >
                {updateAccessMutation.isPending ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" onClick={() => setEditingKey(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
