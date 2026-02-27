"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export default function SolvedProblemsPage() {
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [appType, setAppType] = useState("");
  const [depSearch, setDepSearch] = useState("");

  const tags = tagFilter
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const deps = depSearch.trim() ? [depSearch.trim()] : [];

  const query = useQuery(
    orpc.solvedProblems.list.queryOptions({
      input: {
        ...(search ? { search } : {}),
        ...(tags.length > 0 ? { tags } : {}),
        ...(appType ? { appType } : {}),
        ...(deps.length > 0
          ? { serverDependencies: deps, clientDependencies: deps }
          : {}),
      },
    })
  );

  const solvedProblems = query.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Solved Problems</h1>
          <p className="mt-1 text-muted-foreground">
            Browse and filter your solved problems.
          </p>
        </div>
        <Link href="/solved-problems/new" className={buttonVariants()}>
          New Solved Problem
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Search
              </label>
              <Input
                placeholder="Search by name or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Tags (comma-separated)
              </label>
              <Input
                placeholder="react, typescript..."
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                App Type
              </label>
              <Input
                placeholder="Filter by app type..."
                value={appType}
                onChange={(e) => setAppType(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Dependency
              </label>
              <Input
                placeholder="Search by dependency name..."
                value={depSearch}
                onChange={(e) => setDepSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : solvedProblems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No solved problems found.
            </p>
            <Link
              href="/solved-problems/new"
              className={buttonVariants({ variant: "outline", className: "mt-4" })}
            >
              Create your first solved problem
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {solvedProblems.map((problem) => (
            <Link
              key={problem.id}
              href={`/solved-problems/${problem.id}`}
              className="block"
            >
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="min-w-0">
                    <p className="font-medium">{problem.name}</p>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {problem.description}
                    </p>
                    {problem.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {problem.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="ml-4 shrink-0 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {problem.appType}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
