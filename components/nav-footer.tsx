"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "./ui/menu";
import Link from "next/link";
import { Button } from "./ui/button";
import { MoreVertical } from "lucide-react";

export function NavFooter({
  user,
  className,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
  className?: string;
}) {
  return (
    <SidebarFooter className={"p-4 border-t " + className}>
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex items-center gap-2 justify-between w-full">
            <div className="flex items-center gap-2 w-[calc(100%-32px)]">
              <Avatar className="h-8 w-8 rounded-none">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-none">CN</AvatarFallback>
              </Avatar>

              <div className="font-medium text-sm truncate">
                <span className="text-muted-foreground">@</span>
                {user.name}
              </div>
            </div>
            <Menu>
              <MenuTrigger
                render={
                  <Button
                    variant={"outline"}
                    className="rounded-none"
                    size={"icon-sm"}
                  >
                    <MoreVertical />
                  </Button>
                }
              />
              <MenuPopup className={"rounded-none"}>
                <MenuGroup>
                  <MenuGroupLabel>
                    @<span className="text-primary">{user.name}</span>
                  </MenuGroupLabel>
                  <MenuItem
                    render={<Link href="/dashboard/settings" />}
                    className={"rounded-none"}
                  >
                    Settings
                  </MenuItem>
                  <MenuItem variant="destructive" className={"rounded-none"}>
                    Logout
                  </MenuItem>
                </MenuGroup>
              </MenuPopup>
            </Menu>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}
