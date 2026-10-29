"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default function AppShellWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthOrLanding = pathname === "/" || pathname === "/login" || pathname === "/signup";

  if (isAuthOrLanding) {
    return <main className="min-h-screen bg-surface-subtle dark:bg-[#090D16]">{children}</main>;
  }

  return (
    <div className="flex min-h-screen bg-surface-subtle dark:bg-[#090D16]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
