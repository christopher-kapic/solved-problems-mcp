"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import Loader from "@/components/loader";
import { authClient } from "@/lib/auth-client";

export default function Home() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending) {
      router.push(session ? "/dashboard" : "/sign-in");
    }
  }, [isPending, session, router]);

  return <Loader />;
}
