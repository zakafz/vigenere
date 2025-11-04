"use client";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { MoreVertical } from "lucide-react";
import { usePathname } from "next/navigation";

export default function LayoutShell({ children }: any) {
  const pathname = usePathname();
  const isChat = pathname.startsWith("/dashboard/chat");
  return (
    <>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex justify-between h-12 pr-2 border-b shrink-0 items-center gap-2 transition-[width,height] ease-linear">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="rounded-none" />
              <span className="font-medium text-sm">Page title</span>
            </div>
            {isChat && (
              <div className="flex gap-2 items-center">
                <Button
                  variant={"outline"}
                  size={"sm"}
                  className="rounded-none h-7 px-2"
                >
                  Profile
                </Button>
                <Button variant={"outline"} className="size-7 rounded-none">
                  <MoreVertical />
                </Button>
              </div>
            )}
          </div>
          <main className="h-full">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
