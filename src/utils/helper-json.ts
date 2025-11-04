// utils/save-transcript-to-file.ts
import fs from "fs/promises";
import path from "path";

/**
 * 트랜스크립트를 JSON 파일로 저장
 * @param json 저장할 JSON 데이터
 * @param fileName 파일명
 * @param subName 언어 코드
 * @param storagePath 저장할 폴더 경로 (기본값: '~/Downloads/aiqna/youtube/transcripts')
 * @returns 저장된 파일 경로
 */
export async function saveJsonToLocal(
  json: unknown,
  fileName: string,
  subName: string,
  storagePath: string = "../data/transcripts",
): Promise<string> {
  try {
    const expandedPath = storagePath.startsWith("~")
      ? storagePath.replace("~", process.env.HOME || "")
      : storagePath;

    // 절대 경로로 변환
    const absolutePath = path.resolve(expandedPath);

    console.log(`📁 Original path: ${storagePath}`);
    console.log(`📁 Expanded path: ${expandedPath}`);
    console.log(`📁 Absolute path: ${absolutePath}`);
    console.log(`📁 Creating directory...`);

    await fs.mkdir(absolutePath, { recursive: true });

    const filename = `${fileName}_${subName}.json`;
    const filepath = path.join(absolutePath, filename);

    console.log(`💾 Writing to: ${filepath}`);
    await fs.writeFile(filepath, JSON.stringify(json, null, 2), "utf-8");

    console.log(`✓ JSON saved: ${filepath}`);
    return filepath;
  } catch (error) {
    console.error(`✗ Failed to save JSON:`, error);
    throw error;
  }
}
