"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
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
import { toast } from "sonner";

const dependencySchema = z.object({
  name: z.string().min(1, "Name is required"),
  version: z.string().min(1, "Version is required"),
  packageManager: z.string().min(1, "Package manager is required"),
});

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

export default function NewSolvedProblemPage() {
  const router = useRouter();
  const [serverDeps, setServerDeps] = useState<Dependency[]>([]);
  const [clientDeps, setClientDeps] = useState<Dependency[]>([]);

  const {
    register,
    handleSubmit,
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

  const mutation = useMutation({
    ...orpc.solvedProblems.create.mutationOptions(),
    onSuccess: (data) => {
      toast.success("Solved problem created successfully");
      router.push(`/solved-problems/${data.id}`);
    },
    onError: (error) => {
      toast.error(`Failed to create: ${error.message}`);
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
      name: values.name,
      description: values.description,
      appType: values.appType,
      ...(tags.length > 0 ? { tags } : {}),
      ...(dependencies.length > 0 ? { dependencies } : {}),
      ...(values.details ? { details: values.details } : {}),
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Solved Problem</h1>
        <p className="mt-1 text-muted-foreground">
          Create a new solved problem entry.
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
            {mutation.isPending ? "Creating..." : "Create Solved Problem"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
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
