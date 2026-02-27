"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function SolvedProblemDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const query = useQuery(
    orpc.solvedProblems.get.queryOptions({
      input: { id: params.id },
    })
  );

  const deleteMutation = useMutation({
    ...orpc.solvedProblems.delete.mutationOptions(),
    onSuccess: () => {
      toast.success("Solved problem deleted");
      queryClient.invalidateQueries();
      router.push("/solved-problems");
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const copyMutation = useMutation({
    ...orpc.solvedProblems.create.mutationOptions(),
    onSuccess: (data) => {
      toast.success("Solved problem copied");
      queryClient.invalidateQueries();
      router.push(`/solved-problems/${data.id}`);
    },
    onError: (error) => {
      toast.error(`Failed to copy: ${error.message}`);
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate({ id: params.id });
  };

  const handleCopy = () => {
    if (!query.data) return;
    const sp = query.data;
    copyMutation.mutate({
      name: `${sp.name} (copy)`,
      description: sp.description,
      appType: sp.appType,
      tags: sp.tags.map((t) => t.name),
      dependencies: sp.dependencies.map((d) => ({
        name: d.name,
        version: d.version,
        packageManager: d.packageManager,
        type: d.type as "SERVER" | "CLIENT",
      })),
      ...(sp.latestVersion ? { details: sp.latestVersion.details } : {}),
      copiedFromId: sp.id,
    });
  };

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
              Solved problem not found or you don&apos;t have access.
            </p>
            <Link
              href="/solved-problems"
              className={buttonVariants({ variant: "outline", className: "mt-4" })}
            >
              Back to Solved Problems
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sp = query.data;
  const isOwner = session?.user?.id === sp.owner.id;
  const serverDeps = sp.dependencies.filter((d) => d.type === "SERVER");
  const clientDeps = sp.dependencies.filter((d) => d.type === "CLIENT");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{sp.name}</h1>
          <p className="mt-1 text-muted-foreground">{sp.description}</p>
          {sp.copiedFromId && (
            <p className="mt-1 text-xs text-muted-foreground">
              Forked from{" "}
              <Link
                href={`/solved-problems/${sp.copiedFromId}`}
                className="text-primary hover:underline"
              >
                {sp.copiedFromId}
              </Link>
            </p>
          )}
        </div>
        <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {sp.appType}
        </span>
      </div>

      {/* Owner info */}
      <p className="text-xs text-muted-foreground">
        Owned by {sp.owner.name ?? sp.owner.email}
      </p>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/solved-problems/${sp.id}/edit`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Edit
        </Link>
        <Link
          href={`/solved-problems/${sp.id}/versions`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          View Versions
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          disabled={copyMutation.isPending}
        >
          {copyMutation.isPending ? "Copying..." : "Copy / Fork"}
        </Button>
        {isOwner && (
          <>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
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
                Delete
              </Button>
            )}
          </>
        )}
      </div>

      {/* Tags */}
      {sp.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sp.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Dependencies */}
      {(serverDeps.length > 0 || clientDeps.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {serverDeps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Server Dependencies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {serverDeps.map((dep) => (
                  <div
                    key={dep.id}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="font-medium">{dep.name}</span>
                    <span className="text-muted-foreground">
                      @{dep.version}
                    </span>
                    <span className="text-muted-foreground">
                      ({dep.packageManager})
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {clientDeps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Client Dependencies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {clientDeps.map((dep) => (
                  <div
                    key={dep.id}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="font-medium">{dep.name}</span>
                    <span className="text-muted-foreground">
                      @{dep.version}
                    </span>
                    <span className="text-muted-foreground">
                      ({dep.packageManager})
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Details (Markdown) */}
      {sp.latestVersion && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Details (v{sp.latestVersion.version})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-xs font-mono leading-relaxed">
              {sp.latestVersion.details}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
