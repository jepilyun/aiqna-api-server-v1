export class ErrorTextProcessingLogDuplicate extends Error {
  constructor(text: string) {
    super(`Text Pinecone 처리 로그가 이미 존재합니다. (중복된 Text=${text.slice(0, 100)})`);
    this.name = "ErrorBlogPostProcessingLogDuplicate";
  }
}
