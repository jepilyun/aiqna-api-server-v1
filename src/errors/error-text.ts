export class ErrorTextDuplicate extends Error {
  constructor(text: string) {
    super(`Text가 이미 존재합니다. (중복된 Blog URL=${text.slice(0, 200)})`);
    this.name = "ErrorTextDuplicate";
  }
}
