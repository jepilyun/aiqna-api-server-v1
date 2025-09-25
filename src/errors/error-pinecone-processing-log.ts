export class ErrorPineconeProcessingLogDuplicate extends Error {
  constructor(videoId: string) {
    super(`Pinecone 처리 로그가 이미 존재합니다. (중복된 video_id=${videoId})`);
    this.name = "ErrorPineconeProcessingLogDuplicate";
  }
}

export class ErrorPineconeProcessingLogForeignKey extends Error {
  constructor(videoId: string) {
    super(
      `${videoId}의 비디오 아이디가 테이블에 존재하지 않습니다. (foreign_key=${videoId})`,
    );
    this.name = "ErrorPineconeProcessingLogForeignKey";
  }
}
