import crypto from 'crypto';


export class QueryHashManager {
  // 쿼리를 정규화하고 해시 생성
  static createKey(query: string) {
    // 1. 정규화
    const normalized = query
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    
    // 2. SHA-256 해시
    const hash = crypto
      .createHash('sha256')
      .update(normalized, 'utf8')
      .digest('hex');
    
    // 3. 짧게 (선택사항)
    return hash.substring(0, 16); // 16자면 충분
  }
  
    // 디버깅용: 원본 텍스트도 함께 반환
    static createKeyWithMetadata(query: string) {
      const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ');
      const hash = crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
      
      return {
        key: hash.substring(0, 16),
        fullHash: hash,
        original: query,
        normalized: normalized
      };
    }

    // 16자 해시 (추천)
    static hash16(text: string) {
      return crypto
        .createHash('sha256')
        .update(text, 'utf8')
        .digest('hex')
        .substring(0, 16);
  }
  
  // 12자 해시
  static hash12(text: string) {
    return crypto
      .createHash('sha256')
      .update(text, 'utf8')
      .digest('hex')
      .substring(0, 12);
  }
  
  // 8자 해시 (작은 데이터셋용)
  static hash8(text: string) {
    return crypto
      .createHash('sha256')
      .update(text, 'utf8')
      .digest('hex')
      .substring(0, 8);
  }
}
