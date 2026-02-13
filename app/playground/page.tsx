import { Demo } from "@/components/demo";
import { Header } from "@/components/header";

export default function PlaygroundPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-semibold mb-6">Playground</h1>
          <Demo />
        </div>
      </main>
    </div>
  );
}
