import { Header } from "@/components/header";
import { Playground } from "@/components/playground";

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
