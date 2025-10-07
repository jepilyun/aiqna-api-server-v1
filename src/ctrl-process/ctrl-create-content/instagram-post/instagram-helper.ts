/**
 * Instagram Helper
 */
export class InstagramHelper {
  /**
   * Instagram URL에서 Post ID 추출
   */
  static extractPostId(url: string): string {
    const match = url.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
    return match ? match[2] : url;
  }

  /**
   * Post ID로 Instagram URL 생성
   */
  static buildPostUrl(postId: string): string {
    return `https://www.instagram.com/p/${postId}/`;
  }

  /**
   * URL이 유효한 Instagram Post URL인지 확인
   */
  static isValidPostUrl(url: string): boolean {
    return /instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+/.test(url);
  }
}