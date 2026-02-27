"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

export default function AdminPage() {
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();

  const isAdmin =
    (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const settingsQuery = useQuery({
    ...orpc.admin.getSettings.queryOptions({}),
    enabled: isAdmin,
  });

  const usersQuery = useQuery({
    ...orpc.admin.listUsers.queryOptions({}),
    enabled: isAdmin,
  });

  const updateMutation = useMutation({
    ...orpc.admin.updateSettings.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: orpc.admin.getSettings.queryOptions({}).queryKey,
      });
    },
  });

  const deleteUserMutation = useMutation({
    ...orpc.admin.deleteUser.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: orpc.admin.listUsers.queryOptions({}).queryKey,
      });
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
        <h1 className="text-2xl font-bold">Admin Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Configure site-wide settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Users</CardTitle>
          <CardDescription>
            Manage registered users. Deleting a user removes all their data.
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
                  {user.id !== session?.user?.id && (
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete user "${user.name || user.email}"? This cannot be undone.`
                          )
                        ) {
                          deleteUserMutation.mutate({ userId: user.id });
                        }
                      }}
                      disabled={deleteUserMutation.isPending}
                      className="ml-4 shrink-0 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No users found.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">User Signups</CardTitle>
          <CardDescription>
            Control whether new users can register on the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settingsQuery.isLoading ? (
            <Skeleton className="h-8 w-48" />
          ) : settingsQuery.data ? (
            <div className="flex items-center gap-3">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={settingsQuery.data.signupEnabled}
                  onChange={(e) =>
                    updateMutation.mutate({
                      signupEnabled: e.target.checked,
                    })
                  }
                  disabled={updateMutation.isPending}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-muted after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2" />
              </label>
              <span className="text-sm">
                {settingsQuery.data.signupEnabled
                  ? "Signups are enabled"
                  : "Signups are disabled"}
              </span>
              {updateMutation.isPending && (
                <span className="text-xs text-muted-foreground">Saving...</span>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
