"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function RegisterShell() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-1 flex-col justify-center px-4 py-10 lg:px-6">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <h2 className="text-center text-3xl font-mono mb-2 font-semibold text-foreground dark:text-foreground">
            Vigenère
          </h2>
          <p className="text-center text-sm text-muted-foreground dark:text-muted-foreground">
            Create a new account
          </p>
          <form action="#" method="post" className="mt-6 space-y-4">
            <div>
              <Label className="text-sm font-medium text-foreground dark:text-foreground">
                Username*
              </Label>
              <InputGroup className="mt-2 rounded-none">
                <InputGroupInput
                  type="text"
                  className="*:[input]:ps-1!"
                  placeholder="anonymous"
                />
                <InputGroupAddon>
                  <InputGroupText>@</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </div>
            <div>
              <Label className="text-sm font-medium text-foreground dark:text-foreground">
                Profile Picture URL
              </Label>
              <Input
                type="text"
                placeholder="https://profile-picture.exemple.com"
                className="mt-2 rounded-none"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-foreground dark:text-foreground">
                Bio
              </Label>
              <Textarea
                placeholder="Don't share too much information. Stay anonymous."
                className="mt-2 rounded-none"
              />
              <p className="text-muted-foreground text-xs mt-2">
                Write a short bio. Maximum 160 characters.
              </p>
            </div>
            <Button
              type="submit"
              className="mt-4 w-full py-2 font-medium rounded-none"
            >
              Sign in
            </Button>
          </form>
          <p className="mt-6 text-sm text-muted-foreground dark:text-muted-foreground">
            Have an account?{" "}
            <a
              href="/auth/login"
              className="font-medium text-primary hover:text-primary/90 dark:text-primary dark:hover:text-primary/90"
            >
              Login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
