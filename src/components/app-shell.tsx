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
  // These pages manage their own layout (flex + sidebar), no outer padding needed
  const isFullBleed = pathname.startsWith("/datahub") || pathname.startsWith("/analysis");

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Navbar />
      <main className="flex-1 w-full min-w-0">
        <div
          className={cn(
            "w-full min-w-0",
            isFullBleed
              ? "p-0 max-w-none"
              : "mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8",
          )}
        >
          {children}
        </div>
      </main>
      {!isFullBleed && <Footer />}
    </div>
  );
}