import { env } from "@solved-problems/env/web";
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_SERVER_URL,
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = "/2fa";
      },
    }),
  ],
});
