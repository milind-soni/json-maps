"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { docsNavigation } from "@/lib/docs-navigation";
import { cn } from "@/lib/utils";

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <nav className="space-y-6">
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
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    {item.title}
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
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
                    className={cn(
                      "block text-sm py-1 transition-colors",
                      pathname === item.href
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
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
    </nav>
  );
}
