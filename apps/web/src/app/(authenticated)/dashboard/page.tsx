"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const solvedProblemsQuery = useQuery(
    orpc.solvedProblems.list.queryOptions({
      input: {},
    })
  );
  const draftsQuery = useQuery(orpc.drafts.list.queryOptions({}));

  const solvedProblems = solvedProblemsQuery.data ?? [];
  const drafts = draftsQuery.data ?? [];
  const recentProblems = solvedProblems.slice(0, 5);
  const isLoading = solvedProblemsQuery.isLoading || draftsQuery.isLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Welcome to Solved Problems.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Solved Problems</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? (
                <Skeleton className="h-9 w-12" />
              ) : (
                solvedProblems.length
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Pending Drafts</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? (
                <Skeleton className="h-9 w-12" />
              ) : (
                drafts.length
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link href="/solved-problems/new" className={buttonVariants()}>
          New Solved Problem
        </Link>
        <Link
          href="/groups/new"
          className={buttonVariants({ variant: "outline" })}
        >
          New Group
        </Link>
      </div>

      {/* Recent Solved Problems */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Solved Problems</CardTitle>
          <CardDescription>Last updated solved problems</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : recentProblems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No solved problems yet. Create your first one to get started.
            </p>
          ) : (
            <div className="divide-y">
              {recentProblems.map((problem) => (
                <Link
                  key={problem.id}
                  href={`/solved-problems/${problem.id}`}
                  className="block py-3 first:pt-0 last:pb-0 hover:bg-muted/50 -mx-2 px-2 rounded-md transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{problem.name}</p>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {problem.description}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-4">
                      {problem.appType}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
