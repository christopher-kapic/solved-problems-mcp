"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type ResourceType = "SOLVED_PROBLEM" | "GROUP";

export interface AccessScope {
  resourceType: ResourceType;
  resourceId: string;
}

export function ResourceSelector({
  accesses,
  onChange,
}: {
  accesses: AccessScope[];
  onChange: (accesses: AccessScope[]) => void;
}) {
  const [resourceType, setResourceType] =
    useState<ResourceType>("SOLVED_PROBLEM");
  const [resourceId, setResourceId] = useState("");

  const solvedProblemsQuery = useQuery(
    orpc.solvedProblems.list.queryOptions({ input: {} })
  );
  const groupsQuery = useQuery(orpc.groups.list.queryOptions({}));

  const resources =
    resourceType === "SOLVED_PROBLEM"
      ? (solvedProblemsQuery.data ?? []).map((sp) => ({
          id: sp.id,
          name: sp.name,
        }))
      : (groupsQuery.data ?? []).map((g) => ({ id: g.id, name: g.name }));

  const handleAdd = () => {
    if (!resourceId) return;
    if (
      accesses.some(
        (a) => a.resourceType === resourceType && a.resourceId === resourceId
      )
    ) {
      toast.error("This resource is already added");
      return;
    }
    onChange([...accesses, { resourceType, resourceId }]);
    setResourceId("");
  };

  const handleRemove = (index: number) => {
    onChange(accesses.filter((_, i) => i !== index));
  };

  const getResourceName = (type: ResourceType, id: string) => {
    if (type === "SOLVED_PROBLEM") {
      return (
        solvedProblemsQuery.data?.find((sp) => sp.id === id)?.name ?? id
      );
    }
    return groupsQuery.data?.find((g) => g.id === id)?.name ?? id;
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select
          value={resourceType}
          onChange={(e) => {
            setResourceType(e.target.value as ResourceType);
            setResourceId("");
          }}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="SOLVED_PROBLEM">Solved Problem</option>
          <option value="GROUP">Group</option>
        </select>
        <select
          value={resourceId}
          onChange={(e) => setResourceId(e.target.value)}
          className="flex h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Select a resource...</option>
          {resources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" size="lg" className="shrink-0" onClick={handleAdd}>
          Add
        </Button>
      </div>

      {accesses.length > 0 && (
        <div className="space-y-1">
          {accesses.map((access, index) => (
            <div
              key={`${access.resourceType}-${access.resourceId}`}
              className="flex items-center justify-between rounded border px-2 py-1 text-sm"
            >
              <span>
                <span className="mr-1 text-xs text-muted-foreground">
                  {access.resourceType === "SOLVED_PROBLEM"
                    ? "Problem"
                    : "Group"}
                  :
                </span>
                {getResourceName(access.resourceType, access.resourceId)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => handleRemove(index)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      {accesses.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No resource access added. This key won&apos;t have access to anything
          until resources are added.
        </p>
      )}
    </div>
  );
}
