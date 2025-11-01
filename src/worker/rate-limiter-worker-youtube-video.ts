/**
 * YouTubeRateLimiter
 * YouTube 비디오 처리 레이트 리미터
 */
export class RateLimiterWorkerYouTubeVideo {
  private processedCount = 0;
  private batchLimit: number;
  private isResting = false;

  constructor() {
    // 10~15회 사이 랜덤 배치 크기
    this.batchLimit = this.getRandomInt(10, 15);
    console.log(`📊 Batch limit set to: ${this.batchLimit}`);
  }

  /**
   * 요청 간 대기 시간 (180~600초)
   */
  getNextDelay(): number {
    return this.getRandomInt(180, 600) * 1000; // ms 단위
  }

  /**
   * 배치 완료 후 휴식 시간 (20~40분)
   */
  getRestTime(): number {
    return this.getRandomInt(10, 40) * 60 * 1000; // ms 단위
  }

  /**
   * 처리 카운트 증가
   */
  incrementProcessed(): void {
    this.processedCount++;
    console.log(`📈 Processed: ${this.processedCount}/${this.batchLimit}`);

    if (this.processedCount >= this.batchLimit) {
      this.isResting = true;
      console.log(`🛑 Batch completed! Time for a long rest...`);
    }
  }

  /**
   * 휴식이 필요한지 확인
   */
  shouldRest(): boolean {
    return this.isResting;
  }

  /**
   * 배치 리셋
   */
  resetBatch(): void {
    this.processedCount = 0;
    this.batchLimit = this.getRandomInt(10, 15);
    this.isResting = false;
    console.log(`🔄 Batch reset! New limit: ${this.batchLimit}`);
  }

  /**
   * min ~ max 사이 랜덤 정수
   */
  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
