"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import Loader from "@/components/loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TwoFactorPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const verifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setIsVerifying(true);
    try {
      await authClient.twoFactor.verifyTotp({
        code: code.trim(),
      });
      toast.success("Verified successfully");
      router.push("/dashboard");
    } catch (error) {
      toast.error("Invalid code. Please try again.");
      setCode("");
    } finally {
      setIsVerifying(false);
    }
  };

  const { isPending } = authClient.useSession();

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="mx-auto w-full max-w-md p-6">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
          <p className="mt-2 text-muted-foreground">
            Enter the code from your authenticator app
          </p>
        </div>

        <form onSubmit={verifyTotp} className="space-y-4">
          <div>
            <Label htmlFor="code">Authentication Code</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-2 text-center text-2xl tracking-widest font-mono"
              maxLength={6}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={code.length !== 6 || isVerifying}
          >
            {isVerifying ? "Verifying..." : "Verify"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Button
            variant="link"
            onClick={() => {
              authClient.signOut();
              router.push("/sign-in");
            }}
          >
            Sign out and try another account
          </Button>
        </div>
      </div>
    </div>
  );
}
