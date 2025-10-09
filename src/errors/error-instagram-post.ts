export class ErrorInstagramPostDuplicate extends Error {
  constructor(instagramUrl: string) {
    super(
      `Instagram Post가 이미 존재합니다. (중복된 instagramUrl=${instagramUrl})`,
    );
    this.name = "ErrorInstagramPostDuplicate";
  }
}
