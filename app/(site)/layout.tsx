import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site/SiteFooter";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell min-h-svh bg-white">
      {children}
      <SiteFooter />
    </div>
  );
}
