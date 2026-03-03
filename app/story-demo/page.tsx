"use client";

import { StoryRenderer } from "@/components/story";
import type { StorySpec } from "@/lib/story-spec";

const demoStory: StorySpec = {
  title: "Earthquakes Around the World",
  subtitle: "A journey through Earth's most seismically active regions",
  author: "json-maps",
  theme: "dark",
  layout: "sidebar-left",
  baseSpec: {
    basemap: "dark",
    controls: { zoom: true, compass: true },
  },
  chapters: [
    {
      id: "overview",
      heading: "A Restless Planet",
      content:
        "Every year, Earth experiences over 500,000 detectable earthquakes. About 100,000 can be felt, and roughly 100 cause damage. Let's explore where they happen.",
      view: { center: [0, 20], zoom: 2, pitch: 0, bearing: 0 },
      overlay: {
        text: "Earthquakes Around the World",
        position: "center",
        style: "title",
      },
      duration: "180vh",
    },
    {
      id: "pacific-ring",
      heading: "The Ring of Fire",
      content:
        "About 90% of the world's earthquakes occur along the Ring of Fire, a 40,000 km horseshoe-shaped zone around the Pacific Ocean. Here we can see recent earthquake activity worldwide.",
      view: { center: [170, 10], zoom: 3, pitch: 30, bearing: -20 },
      spec: {
        layers: {
          quakes: {
            type: "geojson",
            data: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson",
            style: {
              pointColor: {
                type: "continuous",
                attr: "mag",
                palette: "OrYel",
                domain: [0, 7],
              },
              pointRadius: 4,
              opacity: 0.85,
            },
            tooltip: ["place", "mag", "time"],
          },
        },
      },
      duration: "200vh",
    },
    {
      id: "japan",
      heading: "Japan's Seismic Zone",
      content:
        "Japan sits at the junction of four tectonic plates. The 2011 Tohoku earthquake measured 9.1 magnitude, triggering a devastating tsunami. The country averages 1,500 seismic events per year.",
      view: { center: [139.7, 36.5], zoom: 6, pitch: 50, bearing: -15 },
      duration: "200vh",
    },
    {
      id: "california",
      heading: "The San Andreas Fault",
      content:
        "California's San Andreas Fault stretches 1,200 km through the state. The \"Big One\" — a magnitude 7.8+ quake — is considered overdue. The last major event on this fault was in 1906.",
      view: { center: [-119.5, 36.5], zoom: 6, pitch: 45, bearing: 10 },
      duration: "200vh",
    },
    {
      id: "turkey",
      heading: "Turkey-Syria 2023",
      content:
        "On February 6, 2023, a 7.8 magnitude earthquake struck southeastern Turkey near the Syrian border. It was followed by a 7.7 aftershock, killing over 50,000 people across both countries.",
      view: { center: [37.2, 37.0], zoom: 7, pitch: 40, bearing: 0 },
      spec: {
        markers: {
          epicenter: {
            coordinates: [37.2, 37.17],
            color: "#ef4444",
            icon: "flag",
            tooltip: "Epicenter · 7.8 magnitude",
            popup: {
              title: "2023 Turkey-Syria Earthquake",
              description:
                "Magnitude 7.8 at 4:17 AM local time. Depth: 17.9 km.",
            },
          },
        },
      },
      duration: "200vh",
    },
    {
      id: "conclusion",
      heading: "Living with Earthquakes",
      content:
        "Earthquake prediction remains one of science's greatest challenges. While we can't prevent earthquakes, better building codes, early warning systems, and preparedness save thousands of lives each year.",
      view: { center: [0, 20], zoom: 2, pitch: 0, bearing: 0 },
      overlay: {
        text: "Be prepared. Stay informed.",
        position: "bottom",
        style: "subtitle",
      },
      duration: "180vh",
    },
  ],
};

export default function StoryDemoPage() {
  return <StoryRenderer story={demoStory} />;
}
