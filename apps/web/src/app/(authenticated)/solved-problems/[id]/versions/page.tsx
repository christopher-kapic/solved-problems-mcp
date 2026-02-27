"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function VersionHistoryPage() {
  const params = useParams<{ id: string }>();
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  const listQuery = useQuery(
    orpc.versions.list.queryOptions({
      input: { solvedProblemId: params.id },
    })
  );

  // Select the latest version by default once data loads
  const versions = listQuery.data ?? [];
  const activeVersion = selectedVersion ?? versions[0]?.version ?? null;

  const detailQuery = useQuery({
    ...orpc.versions.get.queryOptions({
      input: { solvedProblemId: params.id, version: activeVersion! },
    }),
    enabled: activeVersion !== null,
  });

  if (listQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (listQuery.error) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Could not load versions. The solved problem may not exist or you
              don&apos;t have access.
            </p>
            <Link
              href="/solved-problems"
              className={buttonVariants({
                variant: "outline",
                className: "mt-4",
              })}
            >
              Back to Solved Problems
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Version History</h1>
        <Link
          href={`/solved-problems/${params.id}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Back to Detail
        </Link>
      </div>

      {versions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No versions found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          {/* Version list sidebar */}
          <div className="space-y-1">
            {versions.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVersion(v.version)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  v.version === activeVersion
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <div className="font-medium">Version {v.version}</div>
                <div
                  className={`text-xs ${
                    v.version === activeVersion
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  }`}
                >
                  {new Date(v.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </button>
            ))}
          </div>

          {/* Version detail */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Version {activeVersion} Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detailQuery.isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : detailQuery.error ? (
                <p className="text-sm text-muted-foreground">
                  Failed to load version details.
                </p>
              ) : detailQuery.data ? (
                <pre className="whitespace-pre-wrap text-xs font-mono leading-relaxed">
                  {detailQuery.data.details}
                </pre>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
