import { Header } from "@/components/header";
import { DocsSidebar } from "@/components/docs-sidebar";
import { DocsMobileNav } from "@/components/docs-mobile-nav";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <DocsMobileNav />
      <div className="max-w-5xl mx-auto px-6 py-8 lg:py-12 flex gap-16 w-full">
        <aside className="w-48 shrink-0 hidden lg:block sticky top-28 h-[calc(100vh-7rem)] overflow-y-auto">
          <DocsSidebar />
        </aside>
        <div className="flex-1 min-w-0 max-w-2xl pb-20">
          <article>{children}</article>
        </div>
      </div>
    </div>
  );
}
