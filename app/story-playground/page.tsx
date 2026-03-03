import { StoryPlayground } from "@/components/story-playground";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Story Playground",
};

export default function StoryPlaygroundPage() {
  return <StoryPlayground />;
}
