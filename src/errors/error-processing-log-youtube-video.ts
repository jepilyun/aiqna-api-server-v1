export class ErrorYoutubeVideoProcessingLogDuplicate extends Error {
  constructor(videoId: string) {
    super(
      `YouTube Video Pinecone 처리 로그가 이미 존재합니다. (중복된 video_id=${videoId})`,
    );
    this.name = "ErrorYoutubeVideoProcessingLogDuplicate";
  }
}
