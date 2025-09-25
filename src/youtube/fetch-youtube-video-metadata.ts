import { google } from 'googleapis';

// YouTube Data API v3를 사용하여 비디오 메타데이터 가져오기
export async function fetchYoutubeVideoMetadata(videoId: string) {
  try {
    const youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY // API 키 필요
    });

    const response = await youtube.videos.list({
      part: [
        'snippet',
        'statistics', 
        'contentDetails',
        'status',
        'topicDetails'
      ],
      id: [videoId]
    });

    if (!response.data.items || response.data.items.length === 0) {
      throw new Error(`Video not found: ${videoId}`);
    }

    // PostgreSQL 함수가 기대하는 형식 그대로 반환
    return response.data.items[0];
    
  } catch (error) {
    console.error("Error fetching video metadata:", error);
    throw error;
  }
}