"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [filter, setFilter] = useState("");

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

  const selectedIds = new Set(
    accesses
      .filter((a) => a.resourceType === resourceType)
      .map((a) => a.resourceId)
  );

  const filteredResources = resources.filter(
    (r) =>
      filter === "" || r.name.toLowerCase().includes(filter.toLowerCase())
  );

  const toggleResource = (id: string) => {
    if (selectedIds.has(id)) {
      onChange(
        accesses.filter(
          (a) => !(a.resourceType === resourceType && a.resourceId === id)
        )
      );
    } else {
      onChange([...accesses, { resourceType, resourceId: id }]);
    }
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
            setFilter("");
          }}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="SOLVED_PROBLEM">Solved Problems</option>
          <option value="GROUP">Groups</option>
        </select>
        <Input
          placeholder={`Filter ${resourceType === "SOLVED_PROBLEM" ? "solved problems" : "groups"}...`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1"
        />
      </div>

      <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
        {filteredResources.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">
            {resources.length === 0
              ? `No ${resourceType === "SOLVED_PROBLEM" ? "solved problems" : "groups"} available.`
              : "No matches found."}
          </p>
        ) : (
          filteredResources.map((r) => (
            <label
              key={r.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(r.id)}
                onChange={() => toggleResource(r.id)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="truncate">{r.name}</span>
            </label>
          ))
        )}
      </div>

      {accesses.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Selected ({accesses.length})
          </p>
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
                onClick={() =>
                  onChange(accesses.filter((_, i) => i !== index))
                }
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
