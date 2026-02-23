import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export const maxDuration = 30;

function getBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export async function GET(request: NextRequest) {
  // Use raw search string to preserve + signs (URLSearchParams decodes + as space)
  const rawSearch = request.nextUrl.search;
  const specMatch = rawSearch.match(/[?&]spec=([^&]*)/);
  const spec = specMatch?.[1];
  if (!spec) {
    return NextResponse.json(
      { error: "Missing `spec` query parameter (compressed map spec hash)" },
      { status: 400 },
    );
  }

  const width = Math.min(
    Math.max(parseInt(request.nextUrl.searchParams.get("width") ?? "1280", 10) || 1280, 200),
    3840,
  );
  const height = Math.min(
    Math.max(parseInt(request.nextUrl.searchParams.get("height") ?? "720", 10) || 720, 200),
    2160,
  );
  const scale = Math.min(
    Math.max(parseInt(request.nextUrl.searchParams.get("scale") ?? "1", 10) || 1, 1),
    4,
  );

  const isVercel = !!process.env.VERCEL;

  let browser;
  try {
    browser = await puppeteer.launch({
      args: isVercel ? chromium.args : ["--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: { width, height, deviceScaleFactor: scale },
      executablePath: isVercel
        ? await chromium.executablePath()
        : (process.env.CHROME_PATH ??
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
      headless: true,
    });

    const page = await browser.newPage();

    // Force light color scheme so the page doesn't render in dark mode
    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: "light" },
    ]);

    // Decode %2B → + etc. for the hash (lz-string uses + signs)
    const embedUrl = `${getBaseUrl()}/embed?screenshot=1#${decodeURIComponent(spec)}`;
    await page.goto(embedUrl, { waitUntil: "networkidle2" });

    // Wait for map tiles to load (MapLibre idle event)
    await page
      .waitForFunction("window.__JSONMAPS_READY === true", { timeout: 15_000 })
      .catch(() => {
        // Timeout — proceed with whatever is rendered
      });

    // Extra padding for final tile rendering
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const screenshot = await page.screenshot({ type: "png", fullPage: false });

    return new NextResponse(screenshot, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
        "Content-Disposition": "inline",
      },
    });
  } catch (err) {
    console.error("[screenshot]", err);
    return NextResponse.json(
      { error: `Screenshot failed: ${err instanceof Error ? err.message : "unknown error"}` },
      { status: 500 },
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
