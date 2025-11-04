"use client";

import { Search } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { SidebarHeader } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { SidebarData } from "@/components/types";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface NavHeaderProps {
  data: SidebarData;
  className?: string;
}

export function NavHeader({ data, className }: NavHeaderProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <SidebarHeader className={className}>
        <div className="font-semibold text-2xl font-mono h-8 flex">
          Vigenère
        </div>
        <div
          className="flex items-center border  justify-between p-1 pl-2 cursor-pointer"
          onClick={() => setOpen(true)}
        >
          <div className="flex items-center flex-1 gap-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-normal">
              Search
            </span>
          </div>
          <div className="flex items-center justify-center px-2 py-1 border border-border">
            <kbd className="text-muted-foreground inline-flex font-[inherit] text-xs font-medium">
              <span className="opacity-70">⌘K</span>
            </kbd>
          </div>
        </div>
      </SidebarHeader>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        className="rounded-none!"
      >
        <CommandInput
          placeholder="Search everything..."
          className="rounded-none!"
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Chats">
            {data.navMain.map((item) => (
              <CommandItem
                className="py-2!"
                key={item.id}
                onSelect={() => {
                  setOpen(false);
                }}
              >
                <Avatar className="size-7 rounded-none">
                  <AvatarImage src={item.pfp} alt={item.title} />
                  <AvatarFallback>{item.title[0]}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{item.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
