"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./navbar";
import { Footer } from "./footer";
import { cn } from "@/lib/utils";

export function AppShell({
  userEmail: _userEmail,
  children,
}: {
  userEmail: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDataHub = pathname.startsWith("/datahub");

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Navbar />
      <main className="flex-1 w-full min-w-0">
        <div className={cn(
          "w-full min-w-0 px-6 py-8",
          isDataHub ? "max-w-none" : "mx-auto max-w-7xl"
        )}>
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
