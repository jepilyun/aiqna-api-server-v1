export class ErrorPineconeVectorDuplicate extends Error {
  constructor(vectorId: string) {
    super(`Vector Id가 이미 존재합니다. (중복된 Pinecone Vector ID=${vectorId})`);
    this.name = "ErrorPineconeVectorDuplicate";
  }
}
