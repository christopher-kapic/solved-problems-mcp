"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/sign-in");
    }
  }, [isPending, session, router]);

  if (isPending) return <Loader />;
  if (!session) return null;

  return <>{children}</>;
}
