"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { docsNavigation, allDocsPages } from "@/lib/docs-navigation";
import { cn } from "@/lib/utils";

export function DocsMobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const currentPage = useMemo(() => {
    return allDocsPages.find((p) => p.href === pathname);
  }, [pathname]);

  return (
    <div className="lg:hidden sticky top-[3.5rem] z-40 bg-background border-b border-border">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-6 py-3 text-sm"
      >
        <span className="font-medium">{currentPage?.title ?? "Docs"}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("transition-transform", open && "rotate-180")}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-border px-6 py-4 max-h-[60vh] overflow-y-auto space-y-5">
          {docsNavigation.map((section) => (
            <div key={section.title}>
              <h4 className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider mb-2">
                {section.title}
              </h4>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.href}>
                    {item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-muted-foreground py-1"
                        onClick={() => setOpen(false)}
                      >
                        {item.title}
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="opacity-50"
                        >
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "block text-sm py-1",
                          pathname === item.href
                            ? "text-foreground font-medium"
                            : "text-muted-foreground"
                        )}
                      >
                        {item.title}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
