import crypto from "crypto";
import { ERequestCreateContentType } from "../consts/const.js";


/**
 * ContentKeyManager
 * 콘텐츠 키 관리
 */
export class ContentKeyManager {
  /**
   * 콘텐츠 타입별 통일된 키 생성
   * YouTube의 경우 언어 코드 포함
   */
  static createContentKey(
    type: ERequestCreateContentType,
    identifier: string,
    language?: string, // YouTube용 언어 코드
  ): string {
    // YouTube: 원본 ID + 언어 코드 사용
    if (type === ERequestCreateContentType.YoutubeVideo) {
      if (!language)
        throw new Error("Language code required for YouTube content");
      return `yt_${identifier}_${language}`; // 예: yt_dQw4w9WgXcQ_ko
    }

    // Instagram: 원본 코드 사용
    if (type === ERequestCreateContentType.Instagram) {
      return `ig_${ContentKeyManager.extractInstagramCode(identifier)}`; // 예: ig_DPfkhbQiXFd
    }

    // Blog: URL을 해시로 변환
    if (type === ERequestCreateContentType.Blog) {
      const hash = this.hash16(identifier);
      return `blog_${hash}`;
    }

    // Text: 쿼리를 해시로 변환
    if (type === ERequestCreateContentType.Text) {
      const normalized = identifier.trim().toLowerCase().replace(/\s+/g, " ");
      const hash = this.hash16(normalized);
      return `text_${hash}`;
    }

    throw new Error(`Unknown content type: ${type}`);
  }

  /**
   * 청크 ID 생성
   * 형식: {contentKey}_chunk_{index}
   */
  static createChunkId(contentKey: string, index: number): string {
    return `${contentKey}_chunk_${index}`;
  }

  /**
   * Instagram URL에서 코드 추출
   */
  static extractInstagramCode(url: string): string {
    const match = url.match(/\/p\/([A-Za-z0-9_-]+)/);
    if (!match) throw new Error("Invalid Instagram URL");
    return match[1];
  }

  /**
   * 16자 해시 생성
   */
  private static hash16(text: string): string {
    return crypto
      .createHash("sha256")
      .update(text, "utf8")
      .digest("hex")
      .substring(0, 16);
  }

  /**
   * 디버깅/로깅용: 키 정보 반환
   */
  static getKeyInfo(contentKey: string) {
    const parts = contentKey.split("_");
    const type = parts[0];

    if (type === "yt" && parts.length >= 3) {
      return {
        type: "youtube",
        videoId: parts[1],
        language: parts[2],
        fullKey: contentKey,
      };
    }

    return {
      type,
      identifier: parts.slice(1).join("_"),
      fullKey: contentKey,
    };
  }
}
