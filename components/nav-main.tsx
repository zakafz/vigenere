"use client";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { NavItem } from "./types";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

export function NavMain({ items }: { items: NavItem[] }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="pb-2 h-fit rounded-none">
        Chats
      </SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          return (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton tooltip={item.title} className="rounded-none!">
                <Avatar className="size-5.5 rounded-none">
                  <AvatarImage src={item.pfp} alt={item.title} />
                  <AvatarFallback>{item.title[0]}</AvatarFallback>
                </Avatar>
                <span className="font-medium">
                  <span className="text-muted-foreground">@</span>
                  {item.title}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
