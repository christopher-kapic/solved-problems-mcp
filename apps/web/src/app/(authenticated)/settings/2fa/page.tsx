"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import QRCode from "qrcode";

import { authClient } from "@/lib/auth-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type TwoFactorState = "disabled" | "enabling" | "enabled";

export default function SettingsTwoFactorPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [state, setState] = useState<TwoFactorState>("disabled");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"password" | "verify">("password");

  useEffect(() => {
    if (session?.user) {
      const twoFactorEnabled = (session.user as { twoFactorEnabled?: boolean }).twoFactorEnabled;
      setState(twoFactorEnabled ? "enabled" : "disabled");
    }
  }, [session]);

  const handleEnableStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    try {
      const result = await authClient.twoFactor.enable({
        password: password,
      });

      if (result.data?.totpURI) {
        const qrDataUrl = await QRCode.toDataURL(result.data.totpURI);
        setQrCodeUrl(qrDataUrl);
        setStep("verify");
        setState("enabling");
      }
    } catch (error) {
      toast.error("Failed to start 2FA setup. Please check your password.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode.trim() || totpCode.length !== 6) return;

    setIsLoading(true);
    try {
      await authClient.twoFactor.verifyTotp({
        code: totpCode,
        trustDevice: false,
      });
      toast.success("Two-factor authentication enabled!");
      setState("enabled");
      setStep("password");
      setPassword("");
      setTotpCode("");
      setQrCodeUrl("");
    } catch (error) {
      toast.error("Invalid code. Please try again.");
      setTotpCode("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    try {
      await authClient.twoFactor.disable({
        password: password,
      });
      toast.success("Two-factor authentication disabled.");
      setState("disabled");
      setPassword("");
    } catch (error) {
      toast.error("Failed to disable 2FA. Please check your password.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setStep("password");
    setState("disabled");
    setPassword("");
    setTotpCode("");
    setQrCodeUrl("");
  };

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!session) {
    router.push("/sign-in");
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
        <p className="mt-1 text-muted-foreground">
          Secure your account with an authenticator app.
        </p>
      </div>

      {state === "disabled" && (
        <Card>
          <CardHeader>
            <CardTitle>Enable 2FA</CardTitle>
            <CardDescription>
              Use an authenticator app like Google Authenticator, Authy, or 1Password
              to generate one-time codes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEnableStart} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Enter your password to continue</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your account password"
                />
              </div>
              <Button type="submit" disabled={!password.trim() || isLoading}>
                {isLoading ? "Loading..." : "Start Setup"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {state === "enabling" && step === "verify" && (
        <Card>
          <CardHeader>
            <CardTitle>Scan QR Code</CardTitle>
            <CardDescription>
              Scan this QR code with your authenticator app, then enter the code
              it generates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {qrCodeUrl && (
              <div className="flex justify-center">
                <img
                  src={qrCodeUrl}
                  alt="QR Code"
                  className="rounded-lg border p-4"
                />
              </div>
            )}
            <form onSubmit={handleEnableVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="totpCode">Enter verification code</Label>
                <Input
                  id="totpCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={totpCode}
                  onChange={(e) =>
                    setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="text-center text-2xl tracking-widest font-mono"
                  maxLength={6}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={totpCode.length !== 6 || isLoading}
                >
                  {isLoading ? "Verifying..." : "Verify & Enable"}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {state === "enabled" && (
        <Card>
          <CardHeader>
            <CardTitle>2FA Enabled</CardTitle>
            <CardDescription>
              Your account is protected with two-factor authentication.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDisable} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="disablePassword">
                  Enter your password to disable 2FA
                </Label>
                <Input
                  id="disablePassword"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your account password"
                />
              </div>
              <Button
                type="submit"
                variant="destructive"
                disabled={!password.trim() || isLoading}
              >
                {isLoading ? "Disabling..." : "Disable 2FA"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
