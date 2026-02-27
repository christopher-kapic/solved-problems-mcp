"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type ResourceType = "SOLVED_PROBLEM" | "GROUP";
type Permission = "READ" | "WRITE";

function ShareDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [resourceType, setResourceType] = useState<ResourceType>("SOLVED_PROBLEM");
  const [resourceId, setResourceId] = useState("");
  const [permission, setPermission] = useState<Permission>("READ");
  const [lookupError, setLookupError] = useState("");

  const solvedProblemsQuery = useQuery(
    orpc.solvedProblems.list.queryOptions({ input: {} })
  );
  const groupsQuery = useQuery(orpc.groups.list.queryOptions({}));

  const shareMutation = useMutation({
    ...orpc.sharing.share.mutationOptions(),
    onSuccess: () => {
      toast.success("Resource shared successfully");
      queryClient.invalidateQueries();
      onClose();
    },
    onError: (error) => {
      toast.error(`Failed to share: ${error.message}`);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError("");

    if (!email || !resourceId) {
      toast.error("Please fill in all fields");
      return;
    }

    // Look up user by email
    const user = await orpc.sharing.lookupUserByEmail.call({ email });
    if (!user) {
      setLookupError("No user found with that email address");
      return;
    }

    shareMutation.mutate({
      resourceType,
      resourceId,
      sharedWithUserId: user.id,
      permission,
    });
  };

  const resources =
    resourceType === "SOLVED_PROBLEM"
      ? (solvedProblemsQuery.data ?? []).map((sp) => ({
          id: sp.id,
          name: sp.name,
        }))
      : (groupsQuery.data ?? []).map((g) => ({
          id: g.id,
          name: g.name,
        }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Share a Resource</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="share-resource-type">Resource Type</Label>
            <select
              id="share-resource-type"
              value={resourceType}
              onChange={(e) => {
                setResourceType(e.target.value as ResourceType);
                setResourceId("");
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="SOLVED_PROBLEM">Solved Problem</option>
              <option value="GROUP">Group</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="share-resource">Resource</Label>
            <select
              id="share-resource"
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select a resource...</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="share-email">User Email</Label>
            <Input
              id="share-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setLookupError("");
              }}
            />
            {lookupError && (
              <p className="text-xs text-destructive">{lookupError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="share-permission">Permission</Label>
            <select
              id="share-permission"
              value={permission}
              onChange={(e) => setPermission(e.target.value as Permission)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="READ">Read</option>
              <option value="WRITE">Write</option>
            </select>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={shareMutation.isPending}>
              {shareMutation.isPending ? "Sharing..." : "Share"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SharedByMeSection() {
  const queryClient = useQueryClient();
  const query = useQuery(orpc.sharing.listSharedByMe.queryOptions({}));
  const shares = query.data ?? [];

  const updateMutation = useMutation({
    ...orpc.sharing.updatePermission.mutationOptions(),
    onSuccess: () => {
      toast.success("Permission updated");
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const revokeMutation = useMutation({
    ...orpc.sharing.revoke.mutationOptions(),
    onSuccess: () => {
      toast.success("Share revoked");
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast.error(`Failed to revoke: ${error.message}`);
    },
  });

  if (query.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (shares.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You haven&apos;t shared any resources yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {shares.map((share) => {
        const resourceLink =
          share.resourceType === "SOLVED_PROBLEM"
            ? `/solved-problems/${share.resourceId}`
            : `/groups/${share.resourceId}`;

        return (
          <div
            key={share.id}
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
          >
            <div className="min-w-0">
              <Link href={resourceLink as "/"} className="hover:underline">
                <p className="text-sm font-medium">{share.resourceName}</p>
              </Link>
              <p className="text-xs text-muted-foreground">
                {share.resourceType === "SOLVED_PROBLEM"
                  ? "Solved Problem"
                  : "Group"}
                {" shared with "}
                {share.sharedWithUser.name ?? share.sharedWithUser.email}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <select
                value={share.permission}
                onChange={(e) =>
                  updateMutation.mutate({
                    id: share.id,
                    permission: e.target.value as Permission,
                  })
                }
                disabled={updateMutation.isPending}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="READ">Read</option>
                <option value="WRITE">Write</option>
              </select>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => revokeMutation.mutate({ id: share.id })}
                disabled={revokeMutation.isPending}
              >
                Revoke
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SharedWithMeSection() {
  const query = useQuery(orpc.sharing.listSharedWithMe.queryOptions({}));
  const shares = query.data ?? [];

  if (query.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (shares.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No resources have been shared with you.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {shares.map((share) => {
        const resourceLink =
          share.resourceType === "SOLVED_PROBLEM"
            ? `/solved-problems/${share.resourceId}`
            : `/groups/${share.resourceId}`;

        return (
          <div
            key={share.id}
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
          >
            <div className="min-w-0">
              <Link href={resourceLink as "/"} className="hover:underline">
                <p className="text-sm font-medium">{share.resourceName}</p>
              </Link>
              <p className="text-xs text-muted-foreground">
                {share.resourceType === "SOLVED_PROBLEM"
                  ? "Solved Problem"
                  : "Group"}
                {" shared by "}
                {share.sharedByUser.name ?? share.sharedByUser.email}
              </p>
            </div>
            <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              {share.permission}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function SharingPage() {
  const [showShareDialog, setShowShareDialog] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sharing</h1>
          <p className="mt-1 text-muted-foreground">
            Manage shared resources.
          </p>
        </div>
        <Button onClick={() => setShowShareDialog(true)}>
          Share Resource
        </Button>
      </div>

      {showShareDialog && (
        <ShareDialog onClose={() => setShowShareDialog(false)} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Shared by Me</CardTitle>
        </CardHeader>
        <CardContent>
          <SharedByMeSection />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Shared with Me</CardTitle>
        </CardHeader>
        <CardContent>
          <SharedWithMeSection />
        </CardContent>
      </Card>
    </div>
  );
}
