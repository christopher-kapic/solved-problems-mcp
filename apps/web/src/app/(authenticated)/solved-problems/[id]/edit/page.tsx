"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { orpc } from "@/utils/orpc";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
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

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  appType: z.string().min(1, "App type is required"),
  tagsInput: z.string().optional(),
  details: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Dependency {
  name: string;
  version: string;
  packageManager: string;
}

export default function EditSolvedProblemPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverDeps, setServerDeps] = useState<Dependency[]>([]);
  const [clientDeps, setClientDeps] = useState<Dependency[]>([]);
  const [initialized, setInitialized] = useState(false);

  const query = useQuery(
    orpc.solvedProblems.get.queryOptions({
      input: { id: params.id },
    })
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      appType: "",
      tagsInput: "",
      details: "",
    },
  });

  // Pre-populate form when data loads
  useEffect(() => {
    if (query.data && !initialized) {
      const sp = query.data;
      reset({
        name: sp.name,
        description: sp.description,
        appType: sp.appType,
        tagsInput: sp.tags.map((t) => t.name).join(", "),
        details: sp.latestVersion?.details ?? "",
      });
      setServerDeps(
        sp.dependencies
          .filter((d) => d.type === "SERVER")
          .map((d) => ({ name: d.name, version: d.version, packageManager: d.packageManager }))
      );
      setClientDeps(
        sp.dependencies
          .filter((d) => d.type === "CLIENT")
          .map((d) => ({ name: d.name, version: d.version, packageManager: d.packageManager }))
      );
      setInitialized(true);
    }
  }, [query.data, initialized, reset]);

  const mutation = useMutation({
    ...orpc.solvedProblems.update.mutationOptions(),
    onSuccess: () => {
      toast.success("Solved problem updated successfully");
      queryClient.invalidateQueries();
      router.push(`/solved-problems/${params.id}`);
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const onSubmit = (values: FormValues) => {
    const tags = values.tagsInput
      ? values.tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const dependencies = [
      ...serverDeps.map((d) => ({ ...d, type: "SERVER" as const })),
      ...clientDeps.map((d) => ({ ...d, type: "CLIENT" as const })),
    ];

    mutation.mutate({
      id: params.id,
      name: values.name,
      description: values.description,
      appType: values.appType,
      tags,
      dependencies,
      details: values.details ?? "",
    });
  };

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="mx-auto max-w-2xl">
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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit Solved Problem</h1>
        <p className="mt-1 text-muted-foreground">
          Update &ldquo;{query.data.name}&rdquo;
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g. User Authentication with JWT"
                {...register("name")}
              />
              {errors.name?.message && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                rows={3}
                placeholder="Brief description of the solved problem..."
                className="dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 h-auto w-full rounded-none border bg-transparent px-2.5 py-1.5 text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1"
                {...register("description")}
              />
              {errors.description?.message && (
                <p className="text-xs text-destructive">
                  {errors.description.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appType">App Type</Label>
              <Input
                id="appType"
                placeholder="e.g. WEB, API, CLI"
                {...register("appType")}
              />
              {errors.appType?.message && (
                <p className="text-xs text-destructive">
                  {errors.appType.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tagsInput">Tags (comma-separated)</Label>
              <Input
                id="tagsInput"
                placeholder="react, typescript, authentication..."
                {...register("tagsInput")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Dependencies */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Server Dependencies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DependencyList
              deps={serverDeps}
              onChange={setServerDeps}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Client Dependencies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DependencyList
              deps={clientDeps}
              onChange={setClientDeps}
            />
          </CardContent>
        </Card>

        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Details (Markdown)</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              id="details"
              rows={12}
              placeholder="Write the solved problem details in markdown..."
              className="dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 h-auto w-full rounded-none border bg-transparent px-2.5 py-1.5 text-xs font-mono outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1"
              {...register("details")}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/solved-problems/${params.id}`)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

function DependencyList({
  deps,
  onChange,
}: {
  deps: Dependency[];
  onChange: (deps: Dependency[]) => void;
}) {
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [packageManager, setPackageManager] = useState("npm");

  const addDep = () => {
    if (!name.trim() || !version.trim() || !packageManager.trim()) return;
    onChange([...deps, { name: name.trim(), version: version.trim(), packageManager: packageManager.trim() }]);
    setName("");
    setVersion("");
  };

  const removeDep = (index: number) => {
    onChange(deps.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {deps.length > 0 && (
        <div className="space-y-1.5">
          {deps.map((dep, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded border border-border px-2.5 py-1.5 text-xs"
            >
              <span className="font-medium">{dep.name}</span>
              <span className="text-muted-foreground">@{dep.version}</span>
              <span className="text-muted-foreground">({dep.packageManager})</span>
              <button
                type="button"
                className="ml-auto text-muted-foreground hover:text-destructive"
                onClick={() => removeDep(i)}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
        <Input
          placeholder="Package name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Version"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          className="w-24"
        />
        <Input
          placeholder="Manager"
          value={packageManager}
          onChange={(e) => setPackageManager(e.target.value)}
          className="w-20"
        />
        <Button type="button" variant="outline" size="sm" onClick={addDep}>
          Add
        </Button>
      </div>
    </div>
  );
}
