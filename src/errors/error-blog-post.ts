export class ErrorBlogPostDuplicate extends Error {
  constructor(blogUrl: string) {
    super(`Blog Post가 이미 존재합니다. (중복된 Blog URL=${blogUrl})`);
    this.name = "ErrorBlogPostDuplicate";
  }
}
