export class ErrorYoutubeVideoDuplicate extends Error {
  constructor(videoId: string) {
    super(`Youtube 비디오가 이미 존재합니다. (중복된 video_id=${videoId})`);
    this.name = "ErrorYoutubeVideoDuplicate";
  }
}
