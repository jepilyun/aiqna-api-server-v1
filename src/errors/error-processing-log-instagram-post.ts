export class ErrorInstagramPostProcessingLogDuplicate extends Error {
  constructor(instagramUrl: string) {
    super(`Instagram Post Pinecone 처리 로그가 이미 존재합니다. (중복된 Instagram URL=${instagramUrl})`);
    this.name = "ErrorInstagramPostProcessingLogDuplicate";
  }
}
