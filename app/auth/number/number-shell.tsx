"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { CopyIcon } from "lucide-react";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";

export default function NumberShell() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-1 flex-col justify-center px-4 py-10 lg:px-6">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <h2 className="text-center text-3xl font-mono mb-2 font-semibold text-foreground dark:text-foreground">
            Account Number
          </h2>
          <p className="text-center text-sm text-muted-foreground dark:text-muted-foreground">
            Save your account, and don't share it with anyone. It's your secret
            key to access your account. Keep it safe and secure.
          </p>
          <form action="#" method="post" className="mt-6 space-y-4">
            <div>
              <Label
                htmlFor="email-login-03"
                className="text-sm font-medium text-foreground dark:text-foreground"
              >
                Account number
              </Label>
              <InputGroup className="mt-2 rounded-none">
                <InputGroupInput
                  type="text"
                  placeholder="1234-5678-9012"
                  className=""
                />
                <InputGroupAddon align="inline-end">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          aria-label="Copy"
                          size="icon-xs"
                          onClick={() => {}}
                        />
                      }
                    >
                      <CopyIcon />
                    </TooltipTrigger>
                    <TooltipPopup>
                      <p>Copy to clipboard</p>
                    </TooltipPopup>
                  </Tooltip>
                </InputGroupAddon>
              </InputGroup>
            </div>
            <Button
              type="submit"
              className="mt-4 w-full py-2 font-medium rounded-none"
            >
              I Saved it, and won't see it again
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
