"use client"

import { useRef } from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export default function InputGroupWithIconButton() {
  const { copyToClipboard, isCopied } = useCopyToClipboard()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <InputGroup>
      <InputGroupInput
        ref={inputRef}
        type="text"
        defaultValue="https://coss.com"
        aria-label="Url"
        readOnly
      />
      <InputGroupAddon align="inline-end">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                aria-label="Copy"
                size="icon-xs"
                onClick={() => {
                  if (inputRef.current) {
                    copyToClipboard(inputRef.current.value)
                  }
                }}
              />
            }
          >
            {isCopied ? <CheckIcon /> : <CopyIcon />}
          </TooltipTrigger>
          <TooltipPopup>
            <p>Copy to clipboard</p>
          </TooltipPopup>
        </Tooltip>
      </InputGroupAddon>
    </InputGroup>
  )
}
