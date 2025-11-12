import fs from "fs/promises";
import path from "path";

/**
 * 데이터를 파일로 저장 (JSON 또는 텍스트)
 */
export async function saveDataToLocal(
  data: unknown,
  fileName: string,
  subName: string,
  fileType: "json" | "txt" = "json",
  storagePath: string = "../data/transcripts",
  options?: {
    pretty?: boolean; // JSON 포맷 여부 (기본: true)
    encoding?: BufferEncoding; // 인코딩 (기본: 'utf-8')
  }
): Promise<string> {
  const { pretty = true, encoding = "utf-8" } = options ?? {};

  try {
    const expandedPath = storagePath.startsWith("~")
      ? storagePath.replace("~", process.env.HOME || "")
      : storagePath;

    const absolutePath = path.resolve(expandedPath);

    console.log(`📁 Creating directory: ${absolutePath}`);
    await fs.mkdir(absolutePath, { recursive: true });

    const filename = `${fileName}_${subName}.${fileType}`;
    const filepath = path.join(absolutePath, filename);

    // 데이터 포맷 결정
    let content: string;

    if (fileType === "json") {
      content = pretty 
        ? JSON.stringify(data, null, 2) 
        : JSON.stringify(data);
    } else {
      if (typeof data === "string") {
        content = data;
      } else if (typeof data === "object" && data !== null) {
        content = pretty 
          ? JSON.stringify(data, null, 2) 
          : JSON.stringify(data);
      } else {
        content = String(data);
      }
    }

    console.log(`💾 Writing ${content.length} bytes to: ${filepath}`);
    await fs.writeFile(filepath, content, encoding);

    console.log(`✓ File saved successfully`);
    return filepath;
  } catch (error) {
    console.error(`✗ Failed to save file:`, error);
    throw error;
  }
}