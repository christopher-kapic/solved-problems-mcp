"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { orpc } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
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
});

type FormValues = z.infer<typeof formSchema>;

export default function EditGroupPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const query = useQuery(
    orpc.groups.get.queryOptions({ input: { id: params.id } })
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  // Pre-populate form when data loads
  const [initialized, setInitialized] = useState(false);
  if (query.data && !initialized) {
    reset({ name: query.data.name });
    setInitialized(true);
  }

  const updateMutation = useMutation({
    ...orpc.groups.update.mutationOptions(),
    onSuccess: () => {
      toast.success("Group updated");
      queryClient.invalidateQueries();
      router.push(`/groups/${params.id}`);
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    ...orpc.groups.delete.mutationOptions(),
    onSuccess: () => {
      toast.success("Group deleted");
      queryClient.invalidateQueries();
      router.push("/groups");
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const onSubmit = (values: FormValues) => {
    updateMutation.mutate({ id: params.id, name: values.name });
  };

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Group not found or you don&apos;t have access.
            </p>
            <Link
              href="/groups"
              className={buttonVariants({ variant: "outline", className: "mt-4" })}
            >
              Back to Groups
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOwner = session?.user?.id === query.data.ownerId;

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Only the group owner can edit this group.
            </p>
            <Link
              href={`/groups/${params.id}`}
              className={buttonVariants({ variant: "outline", className: "mt-4" })}
            >
              Back to Group
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit Group</h1>
        <p className="mt-1 text-muted-foreground">
          Rename or delete this group.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Group Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g. Authentication Patterns"
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

        <div className="flex gap-3">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/groups/${params.id}`)}
          >
            Cancel
          </Button>
        </div>
      </form>

      {/* Delete Section */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-sm text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Deleting a group does not delete the solved problems in it.
          </p>
          {showDeleteConfirm ? (
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate({ id: params.id })}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Confirm Delete"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete Group
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
