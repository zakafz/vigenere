"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginShell() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-1 flex-col justify-center px-4 py-10 lg:px-6">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <h2 className="text-center text-3xl font-mono mb-2 font-semibold text-foreground dark:text-foreground">
            Vigenère
          </h2>
          <p className="text-center text-sm text-muted-foreground dark:text-muted-foreground">
            Enter your account number to access your account.
          </p>
          <form action="#" method="post" className="mt-6 space-y-4">
            <div>
              <Label
                htmlFor="email-login-03"
                className="text-sm font-medium text-foreground dark:text-foreground"
              >
                Account number
              </Label>
              <Input
                type="text"
                placeholder="1234-5678-9012"
                className="mt-2 rounded-none"
              />
            </div>
            <Button
              type="submit"
              className="mt-4 w-full py-2 font-medium rounded-none"
            >
              Sign in
            </Button>
          </form>
          <p className="mt-6 text-sm text-muted-foreground dark:text-muted-foreground">
            Don't have an account?{" "}
            <a
              href="/auth/register"
              className="font-medium text-primary hover:text-primary/90 dark:text-primary dark:hover:text-primary/90"
            >
              Register
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
