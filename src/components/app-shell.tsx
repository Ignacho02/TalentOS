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
  const isFullWidth = pathname.startsWith("/datahub") || pathname.startsWith("/analysis");

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Navbar />
      <main className="flex-1 w-full min-w-0">
        <div className={cn(
          "w-full min-w-0",
          isFullWidth ? "max-w-none" : "mx-auto max-w-7xl px-6 py-8"
        )}>
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}