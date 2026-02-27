"use client";

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

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewGroupPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  const mutation = useMutation({
    ...orpc.groups.create.mutationOptions(),
    onSuccess: (data) => {
      toast.success("Group created successfully");
      router.push(`/groups/${data.id}`);
    },
    onError: (error) => {
      toast.error(`Failed to create group: ${error.message}`);
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate({ name: values.name });
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Group</h1>
        <p className="mt-1 text-muted-foreground">
          Create a new solved problem group.
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
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating..." : "Create Group"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/groups")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
