import { Header } from "@/components/header";
import { Playground } from "@/components/playground";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("playground");

export default function PlaygroundPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-6">
        <Playground />
      </main>
    </div>
  );
}
