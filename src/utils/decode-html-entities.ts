/**
 * HTML 엔티티를 디코딩하는 헬퍼 함수 (Node.js 환경용)
 * 브라우저의 document 객체 대신 직접 치환하는 방식 사용
 * 
 * @param text - 디코딩할 텍스트
 * @returns 디코딩된 텍스트
 */
import { decode } from 'html-entities';

export const decodeHtmlEntities = (text: string): string => {
  if (!text || typeof text !== 'string') return text;
  return decode(text);
};