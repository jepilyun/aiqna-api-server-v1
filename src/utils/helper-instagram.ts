// Instagram URL 파싱 함수
export function getInstagramPostId(url: string): string {
  try {
    // URL 객체로 파싱
    const urlObj = new URL(url);
    
    // pathname에서 ID 추출
    // 예: "/p/ABC123xyz/" → "ABC123xyz"
    // 예: "/reel/ABC123xyz/" → "ABC123xyz"
    const parts = urlObj.pathname.split('/').filter(Boolean);
    
    // 일반적으로 ["p" 또는 "reel", "ID"] 형태
    return parts[parts.length - 1] || 'unknown';
  } catch (error) {
    console.error('Invalid Instagram URL:', error);
    return 'unknown';
  }
}