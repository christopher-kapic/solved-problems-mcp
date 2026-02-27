"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import Loader from "@/components/loader";
import SignInForm from "@/components/sign-in-form";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (session) {
      router.push("/dashboard");
    }
  }, [session, router]);

  if (isPending || session) return <Loader />;

  return (
    <div className="flex h-full items-center justify-center">
      <SignInForm onSwitchToSignUp={() => router.push("/sign-up")} />
    </div>
  );
}
