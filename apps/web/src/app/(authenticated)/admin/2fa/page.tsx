"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminTwoFactorPage() {
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();

  const isAdmin =
    (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const usersQuery = useQuery({
    ...orpc.admin.listUsers.queryOptions({}),
    enabled: isAdmin,
  });

  const disableTwoFactorMutation = useMutation({
    ...orpc.admin.disableTwoFactor.mutationOptions(),
    onSuccess: () => {
      toast.success("2FA disabled for user");
      queryClient.invalidateQueries({
        queryKey: orpc.admin.listUsers.queryOptions({}).queryKey,
      });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to disable 2FA");
    },
  });

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-muted-foreground">
          You must be an admin to access this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
        <p className="mt-1 text-muted-foreground">
          Manage two-factor authentication for users.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Users with 2FA</CardTitle>
          <CardDescription>
            Admins can disable 2FA for users who have lost their authenticator
            app access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : usersQuery.data?.length ? (
            <div className="divide-y">
              {usersQuery.data.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {user.name || "Unnamed"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user.role} &middot; Joined{" "}
                      {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <span
                      className={`text-xs ${
                        user.twoFactorEnabled
                          ? "text-green-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      {user.twoFactorEnabled ? "2FA Enabled" : "2FA Disabled"}
                    </span>
                    {user.twoFactorEnabled && user.id !== session?.user?.id && (
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Disable 2FA for "${user.name || user.email}"? They will need to set it up again.`
                            )
                          ) {
                            disableTwoFactorMutation.mutate({
                              userId: user.id,
                            });
                          }
                        }}
                        disabled={disableTwoFactorMutation.isPending}
                        className="shrink-0 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Disable 2FA
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No users found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
