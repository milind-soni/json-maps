import { Header } from "@/components/header";
import { GlobalChat } from "@/components/global-chat";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <GlobalChat />
    </div>
  );
}
