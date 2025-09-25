export class ErrorYoutubeVideoTranscriptDuplicate extends Error {
  constructor(videoId: string) {
    super(`Youtube 비디오 트랜스크립트가 이미 존재합니다. (중복된 video_id=${videoId})`);
    this.name = "ErrorYoutubeVideoTranscriptDuplicate";
  }
}

export class ErrorYoutubeVideoTranscriptForeignKey extends Error {
  constructor(videoId: string) {
    super(
      `${videoId}의 비디오 아이디가 테이블에 존재하지 않습니다. (foreign_key=${videoId})`,
    );
    this.name = "ErrorYoutubeVideoTranscriptForeignKey";
  }
}
