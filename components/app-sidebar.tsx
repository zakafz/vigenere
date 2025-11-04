"use client";

import { Sidebar, SidebarContent } from "@/components/ui/sidebar";

import { NavFooter } from "@/components/nav-footer";
import { NavHeader } from "@/components/nav-header";
import { NavMain } from "@/components/nav-main";
import type { SidebarData } from "./types";

const data: SidebarData = {
  user: {
    name: "ephraim",
    email: "ephraim@blocks.so",
    avatar: "/avatar-01.png",
  },
  navMain: [
    {
      id: "overview",
      title: "Overview",
      url: "#",
      pfp: "https://avatars.githubusercontent.com/u/115744911?s=48&v=4",
      isActive: true,
    },
    {
      id: "tasks",
      title: "Tasks",
      url: "#",
      pfp: "https://avatars.githubusercontent.com/u/115744911?s=48&v=4",
    },
    {
      id: "meetings",
      title: "Meetings",
      url: "#",
      pfp: "https://avatars.githubusercontent.com/u/115744911?s=48&v=4",
    },
    {
      id: "notes",
      title: "Notes",
      url: "#",
      pfp: "https://avatars.githubusercontent.com/u/115744911?s=48&v=4",
    },
    {
      id: "calendar",
      title: "Calendar",
      url: "#",
      pfp: "https://avatars.githubusercontent.com/u/115744911?s=48&v=4",
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <NavHeader data={data} className="bg-[#18181A]" />
      <SidebarContent className="bg-[#18181A]">
        <NavMain items={data.navMain} />
      </SidebarContent>
      <NavFooter user={data.user} className="bg-[#18181A]" />
    </Sidebar>
  );
}
