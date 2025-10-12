import puppeteer from "puppeteer";
import { v4 as uuidv4 } from "uuid";
import { extension as mimeExtension } from "mime-types";
import { TBlogPostHTMLMetadata } from "../../types/shared.js";

/**
 * Blog Post Metadata 파싱 (Puppeteer 사용)
 */
export const fetchBlogPostHTMLMetadata = async (
  blogUrl: string,
): Promise<TBlogPostHTMLMetadata> => {
  let browser;

  try {
    console.log("🌐 Launching browser for:", blogUrl);

    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    });

    console.log("🔄 Loading page...");

    await page.goto(blogUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    console.log("✅ Page loaded");

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const metadata = await page.evaluate(() => {
      const getMeta = (property: string): string | null => {
        const meta =
          document.querySelector(`meta[property="${property}"]`) ||
          document.querySelector(`meta[name="${property}"]`);
        return meta?.getAttribute("content") || null;
      };

      return {
        og_title: getMeta("og:title"),
        og_description: getMeta("og:description"),
        og_image: getMeta("og:image"),
        og_url: getMeta("og:url"),
        local_image_url: null,
      };
    });

    console.log("📦 Extracted metadata:", metadata);

    const hasData = Object.values(metadata).some((value) => value !== null);
    if (!hasData) {
      console.warn("⚠️ No metadata found - Blog may be blocking the request");

      const htmlContent = await page.content();
      console.log("📄 HTML length:", htmlContent.length);
      console.log("📄 HTML preview:", htmlContent.substring(0, 500));
    }

    // 이미지 다운로드 및 Supabase 업로드
    if (metadata.og_image) {
      try {
        console.log("🖼️ Downloading image:", metadata.og_image);

        const imageResponse = await fetch(metadata.og_image);

        if (!imageResponse.ok) {
          throw new Error(`Image fetch failed: ${imageResponse.status}`);
        }

        const contentType =
          imageResponse.headers.get("content-type") || "image/jpeg";
        const ext = mimeExtension(contentType) || "jpg";
        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const fileName = `${uuidv4()}.${ext}`;
        const filePath = `blog/${fileName}`; // ✅ instagram → blog

        console.log("📤 Uploading image to Supabase:", filePath);

        // TODO: Supabase 업로드 코드 구현
      } catch (imageError) {
        console.error("❌ Image download/upload error:", imageError);
      }
    }

    return metadata;
  } catch (error) {
    console.error("❌ Failed to fetch Blog metadata:", error); // ✅ 에러 메시지 수정
    throw error;
  } finally {
    if (browser) {
      console.log("🔒 Closing browser");
      await browser.close();
    }
  }
};
