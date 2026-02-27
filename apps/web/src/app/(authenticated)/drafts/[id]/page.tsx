"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useState } from "react";

interface ProposedData {
  name?: string;
  description?: string;
  appType?: string;
  tags?: string[];
  dependencies?: {
    name: string;
    version: string;
    packageManager: string;
    type: "SERVER" | "CLIENT";
  }[];
  details?: string;
}

export default function DraftDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<
    "approve" | "reject" | null
  >(null);

  const query = useQuery(
    orpc.drafts.get.queryOptions({ input: { id: params.id } })
  );
  const draft = query.data;
  const proposed = draft?.proposedData as ProposedData | undefined;

  const approveMutation = useMutation({
    ...orpc.drafts.approve.mutationOptions(),
    onSuccess: () => {
      toast.success("Draft approved and applied");
      queryClient.invalidateQueries();
      router.push("/drafts");
    },
    onError: (error) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });

  const rejectMutation = useMutation({
    ...orpc.drafts.reject.mutationOptions(),
    onSuccess: () => {
      toast.success("Draft rejected");
      queryClient.invalidateQueries();
      router.push("/drafts");
    },
    onError: (error) => {
      toast.error(`Failed to reject: ${error.message}`);
    },
  });

  const copyMutation = useMutation({
    ...orpc.drafts.copyToOwn.mutationOptions(),
    onSuccess: (data) => {
      toast.success("Copied as your own solved problem");
      queryClient.invalidateQueries();
      router.push(`/solved-problems/${data.id}`);
    },
    onError: (error) => {
      toast.error(`Failed to copy: ${error.message}`);
    },
  });

  const isPending =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    copyMutation.isPending;

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (query.error || !draft) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-lg font-semibold">Draft not found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This draft doesn&apos;t exist or you don&apos;t have access.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/drafts")}
        >
          Back to Drafts
        </Button>
      </div>
    );
  }

  // Extract existing data for comparison (update drafts only)
  const existing = draft.solvedProblem;
  const existingVersion = existing?.versions?.[0];
  const existingTags =
    existing?.tags?.map((t) => t.tag.name).sort() ?? [];
  const existingDeps = existing?.dependencies ?? [];
  const isUpdate = !!draft.solvedProblemId;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {proposed?.name ?? "Untitled Draft"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isUpdate ? "Update proposal" : "New solved problem proposal"}
            {draft.apiKey && <> via API key &quot;{draft.apiKey.name}&quot;</>}
            {" · "}
            {new Date(draft.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {confirmAction === "approve" ? (
          <div className="flex items-center gap-2">
            <span className="text-sm">Approve and apply this draft?</span>
            <Button
              size="sm"
              onClick={() => {
                approveMutation.mutate({ id: draft.id });
                setConfirmAction(null);
              }}
              disabled={isPending}
            >
              Confirm Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmAction(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        ) : confirmAction === "reject" ? (
          <div className="flex items-center gap-2">
            <span className="text-sm">Reject this draft?</span>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                rejectMutation.mutate({ id: draft.id });
                setConfirmAction(null);
              }}
              disabled={isPending}
            >
              Confirm Reject
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmAction(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <Button
              onClick={() => setConfirmAction("approve")}
              disabled={isPending}
            >
              Approve
            </Button>
            <Button
              variant="destructive"
              onClick={() => setConfirmAction("reject")}
              disabled={isPending}
            >
              Reject
            </Button>
            <Button
              variant="outline"
              onClick={() => copyMutation.mutate({ id: draft.id })}
              disabled={isPending}
            >
              Copy to Own
            </Button>
          </>
        )}
      </div>

      {/* Proposed Data */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Proposed */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {isUpdate ? "Proposed Changes" : "Proposed Data"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Name" value={proposed?.name} />
            <Field label="Description" value={proposed?.description} />
            <Field label="App Type" value={proposed?.appType} />
            {proposed?.tags && proposed.tags.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Tags
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {proposed.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-primary/10 px-2 py-0.5 text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {proposed?.dependencies && proposed.dependencies.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Dependencies
                </p>
                <div className="mt-1 space-y-1">
                  {proposed.dependencies.map((dep, i) => (
                    <p key={i} className="text-sm">
                      <span
                        className={`mr-1 rounded px-1 py-0.5 text-xs ${
                          dep.type === "SERVER"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {dep.type}
                      </span>
                      {dep.name}@{dep.version}{" "}
                      <span className="text-muted-foreground">
                        ({dep.packageManager})
                      </span>
                    </p>
                  ))}
                </div>
              </div>
            )}
            {proposed?.details && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Details
                </p>
                <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
                  {proposed.details}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Existing (for update drafts) */}
        {isUpdate && existing && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Current Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Name" value={existing.name} />
              <Field label="Description" value={existing.description} />
              <Field label="App Type" value={existing.appType} />
              {existingTags.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Tags
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {existingTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-primary/10 px-2 py-0.5 text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {existingDeps.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Dependencies
                  </p>
                  <div className="mt-1 space-y-1">
                    {existingDeps.map((dep, i) => (
                      <p key={i} className="text-sm">
                        <span
                          className={`mr-1 rounded px-1 py-0.5 text-xs ${
                            dep.type === "SERVER"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {dep.type}
                        </span>
                        {dep.name}@{dep.version}{" "}
                        <span className="text-muted-foreground">
                          ({dep.packageManager})
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {existingVersion?.details && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Details
                  </p>
                  <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
                    {existingVersion.details}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  );
}
