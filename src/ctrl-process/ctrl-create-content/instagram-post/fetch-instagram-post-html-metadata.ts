import puppeteer from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import { extension as mimeExtension } from 'mime-types';
import { TInstagramPostHTMLMetadata } from '../../../types/shared.js';

/**
 * Instagram Metadata 파싱 (Puppeteer 사용)
 */
export const fetchInstagramPostHTMLMetadata = async (
  instagramPostUrl: string
): Promise<TInstagramPostHTMLMetadata> => {
  let browser;
  
  try {
    console.log('🌐 Launching browser for:', instagramPostUrl);
    
    // Puppeteer로 브라우저 실행
    browser = await puppeteer.launch({ 
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Docker 환경에서 메모리 문제 방지
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // User-Agent 설정
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    // 추가 헤더 설정
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });
    
    console.log('🔄 Loading page...');
    
    // 페이지 로드
    await page.goto(instagramPostUrl, { 
      waitUntil: 'networkidle2', // networkidle0 대신 networkidle2 사용 (더 빠름)
      timeout: 30000 
    });
    
    console.log('✅ Page loaded');
    
    // 페이지가 완전히 로드될 때까지 조금 더 기다리기 (선택사항)
    await new Promise(resolve => setTimeout(resolve, 2000)); 
    
    // 메타데이터 추출
    const metadata = await page.evaluate(() => {
      const getMeta = (property: string): string | null => {
        const meta = document.querySelector(`meta[property="${property}"]`) ||
                      document.querySelector(`meta[name="${property}"]`);
        return meta?.getAttribute('content') || null;
      };
      
      return {
        og_title: getMeta('og:title'),
        og_description: getMeta('og:description'),
        og_image: getMeta('og:image'),
        og_url: getMeta('og:url'),
        og_ios_url: getMeta('al:ios:url'),
        og_android_package: getMeta('al:android:package'),
        og_android_url: getMeta('al:android:url'),
        localImageUrl: null,
      };
    });

    console.log('📦 Extracted metadata:', metadata);

    // 메타데이터가 비어있는지 확인
    const hasData = Object.values(metadata).some(value => value !== null);
    if (!hasData) {
      console.warn('⚠️ No metadata found - Instagram may be blocking the request');
      
      // HTML 내용 일부 로깅 (디버깅용)
      const htmlContent = await page.content();
      console.log('📄 HTML length:', htmlContent.length);
      console.log('📄 HTML preview:', htmlContent.substring(0, 500));
    }

    // 이미지 다운로드 및 Supabase 업로드
    if (metadata.og_image) {
      try {
        console.log('🖼️ Downloading image:', metadata.og_image);
        
        const imageResponse = await fetch(metadata.og_image);
        
        if (!imageResponse.ok) {
          throw new Error(`Image fetch failed: ${imageResponse.status}`);
        }

        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
        const ext = mimeExtension(contentType) || 'jpg';
        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const fileName = `${uuidv4()}.${ext}`;
        const filePath = `instagram/${fileName}`;

        console.log('📤 Uploading image to Supabase:', filePath);
        
        // TODO: Supabase 업로드 코드 구현
        // const { error } = await supabase.storage
        //   .from('insta')
        //   .upload(filePath, buffer, {
        //     contentType,
        //     upsert: true,
        //   });

        // if (!error) {
        //   const { data } = supabase.storage
        //     .from('insta')
        //     .getPublicUrl(filePath);
        //   metadata.localImageUrl = data.publicUrl;
        //   console.log('✅ Image uploaded:', metadata.localImageUrl);
        // }
      } catch (imageError) {
        console.error('❌ Image download/upload error:', imageError);
      }
    }

    return metadata;
  } catch (error) {
    console.error('❌ Failed to fetch Instagram metadata:', error);
    throw error;
  } finally {
    if (browser) {
      console.log('🔒 Closing browser');
      await browser.close();
    }
  }
};