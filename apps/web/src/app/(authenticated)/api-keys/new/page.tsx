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
  CardDescription,
} from "@/components/ui/card";
import { toast } from "sonner";
import { ResourceSelector, type AccessScope } from "@/components/resource-selector";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

type FormValues = z.infer<typeof formSchema>;

function KeyDisplay({
  apiKey,
  onDismiss,
}: {
  apiKey: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    toast.success("API key copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Card className="border-yellow-500/50">
        <CardHeader>
          <CardTitle className="text-sm">API Key Created</CardTitle>
          <CardDescription className="text-yellow-600">
            Copy your API key now. You won&apos;t be able to see it again!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-auto rounded bg-muted p-3 text-sm">
              {apiKey}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Store this key securely. It will not be shown again after you leave
            this page.
          </p>
          <Button onClick={onDismiss}>Done</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewApiKeyPage() {
  const router = useRouter();
  const [accesses, setAccesses] = useState<AccessScope[]>([]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  const mutation = useMutation({
    ...orpc.apiKeys.create.mutationOptions(),
    onSuccess: (data) => {
      setCreatedKey(data.key);
    },
    onError: (error) => {
      toast.error(`Failed to create API key: ${error.message}`);
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate({ name: values.name, accesses });
  };

  if (createdKey) {
    return (
      <KeyDisplay
        apiKey={createdKey}
        onDismiss={() => router.push("/api-keys")}
      />
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New API Key</h1>
        <p className="mt-1 text-muted-foreground">
          Create an API key for MCP access.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Key Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g. Claude Code MCP"
                {...register("name")}
              />
              {errors.name?.message && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Resource Access</CardTitle>
            <CardDescription>
              Choose which solved problems and groups this key can access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResourceSelector accesses={accesses} onChange={setAccesses} />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating..." : "Create API Key"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/api-keys")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
