"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function GroupsPage() {
  const query = useQuery(orpc.groups.list.queryOptions({}));
  const groups = query.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Groups</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your solved problem groups.
          </p>
        </div>
        <Link href="/groups/new" className={buttonVariants()}>
          New Group
        </Link>
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No groups found.</p>
            <Link
              href="/groups/new"
              className={buttonVariants({ variant: "outline", className: "mt-4" })}
            >
              Create your first group
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="block"
            >
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="min-w-0">
                    <p className="font-medium">{group.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {group.solvedProblemCount} solved problem{group.solvedProblemCount !== 1 ? "s" : ""}
                      {" · "}
                      Owner: {group.owner.name || group.owner.email}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
