export class ErrorBlogPostProcessingLogDuplicate extends Error {
  constructor(blogUrl: string) {
    super(`Blog Post Pinecone 처리 로그가 이미 존재합니다. (중복된 Blog URL=${blogUrl})`);
    this.name = "ErrorBlogPostProcessingLogDuplicate";
  }
}
