import {
  TPineconeMetadata,
  TPineconeQueryResult,
  TPineconeVector,
} from "aiqna_common_v1";
import pineconeClient from "../../config/pinecone-client.js";

/**
 * DBPinecone
 * Pinecone 벡터 저장소 관리를 위한 범용 컨트롤러
 */
export default class DBPinecone {
  /**
   * 단일 벡터 저장 (Upsert)
   * @param indexName Pinecone 인덱스명
   * @param vector 저장할 벡터 (id, values, metadata)
   * @param namespace 네임스페이스 (선택)
   */
  static async upsertOne(
    indexName: string,
    vector: TPineconeVector,
    namespace?: string,
  ): Promise<void> {
    try {
      const index = pineconeClient.index(indexName);

      if (namespace) {
        await index.namespace(namespace).upsert([vector]);
      } else {
        await index.upsert([vector]);
      }

      console.log(`✓ Upserted vector: ${vector.id}`);
    } catch (error) {
      console.error(`Failed to upsert vector:`, error);
      throw error;
    }
  }

  /**
   * 여러 벡터 저장 (Upsert)
   * @param indexName Pinecone 인덱스명
   * @param vectors 저장할 벡터 배열
   * @param namespace 네임스페이스 (선택)
   */
  static async upsertMany(
    indexName: string,
    vectors: TPineconeVector[],
    namespace?: string,
  ): Promise<void> {
    try {
      const index = pineconeClient.index(indexName);

      if (namespace) {
        await index.namespace(namespace).upsert(vectors);
      } else {
        await index.upsert(vectors);
      }

      console.log(`✓ Upserted ${vectors.length} vectors`);
    } catch (error) {
      console.error(`Failed to upsert vectors:`, error);
      throw error;
    }
  }

  /**
   * 배치 저장 (대량 벡터 처리)
   * @param indexName Pinecone 인덱스명
   * @param vectors 저장할 벡터 배열
   * @param batchSize 배치 크기 (기본 100)
   * @param namespace 네임스페이스 (선택)
   */
  static async upsertBatch(
    indexName: string,
    vectors: TPineconeVector[],
    batchSize: number = 100,
    namespace?: string,
  ): Promise<void> {
    try {
      const index = pineconeClient.index(indexName);
      const totalBatches = Math.ceil(vectors.length / batchSize);

      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;

        console.log(
          `  Batch ${batchNum}/${totalBatches}: uploading ${batch.length} vectors...`,
        );

        if (namespace) {
          await index.namespace(namespace).upsert(batch);
        } else {
          await index.upsert(batch);
        }
      }

      console.log(
        `✓ Upserted ${vectors.length} vectors in ${totalBatches} batches`,
      );
    } catch (error) {
      console.error(`Failed to batch upsert vectors:`, error);
      throw error;
    }
  }

  /**
   * 벡터 검색 (유사도 기반)
   * @param indexName Pinecone 인덱스명
   * @param queryVector 쿼리 벡터
   * @param topK 상위 K개 결과 (기본 10)
   * @param filter 메타데이터 필터 (선택)
   * @param namespace 네임스페이스 (선택)
   * @param includeValues 벡터 값 포함 여부 (기본 true)
   * @returns 검색 결과
   */
  static async query(
    indexName: string,
    queryVector: number[],
    topK: number = 10,
    filter?: TPineconeMetadata,
    namespace?: string,
    includeValues: boolean = true,
  ): Promise<TPineconeQueryResult[]> {
    try {
      const index = pineconeClient.index(indexName);

      const queryRequest: {
        vector: number[];
        topK: number;
        includeMetadata: boolean;
        includeValues: boolean;
        filter?: TPineconeMetadata;
      } = {
        vector: queryVector,
        topK,
        includeMetadata: true,
        includeValues,
      };

      if (filter) {
        queryRequest.filter = filter;
      }

      const queryResponse = namespace
        ? await index.namespace(namespace).query(queryRequest)
        : await index.query(queryRequest);

      return (queryResponse.matches || []).map((match) => ({
        id: match.id,
        score: match.score || 0,
        values: match.values,
        metadata: match.metadata as TPineconeMetadata | undefined,
      }));
    } catch (error) {
      console.error(`Failed to query vectors:`, error);
      throw error;
    }
  }

  /**
   * ID로 벡터 조회
   * @param indexName Pinecone 인덱스명
   * @param ids 벡터 ID 배열
   * @param namespace 네임스페이스 (선택)
   * @returns 벡터 데이터 맵
   */
  static async fetch(
    indexName: string,
    ids: string[],
    namespace?: string,
  ): Promise<Record<string, TPineconeVector>> {
    try {
      const index = pineconeClient.index(indexName);

      const fetchResponse = namespace
        ? await index.namespace(namespace).fetch(ids)
        : await index.fetch(ids);

      const result: Record<string, TPineconeVector> = {};

      if (fetchResponse.records) {
        for (const [id, record] of Object.entries(fetchResponse.records)) {
          result[id] = {
            id,
            values: record.values || [],
            metadata: record.metadata,
          };
        }
      }

      return result;
    } catch (error) {
      console.error(`Failed to fetch vectors:`, error);
      throw error;
    }
  }

  /**
   * 단일 벡터 조회
   * @param indexName Pinecone 인덱스명
   * @param id 벡터 ID
   * @param namespace 네임스페이스 (선택)
   * @returns 벡터 데이터 또는 null
   */
  static async fetchOne(
    indexName: string,
    id: string,
    namespace?: string,
  ): Promise<TPineconeVector | null> {
    const result = await this.fetch(indexName, [id], namespace);
    return result[id] || null;
  }

  /**
   * 벡터 삭제 (단일 ID)
   * @param indexName Pinecone 인덱스명
   * @param id 삭제할 벡터 ID
   * @param namespace 네임스페이스 (선택)
   */
  static async deleteOne(
    indexName: string,
    id: string,
    namespace?: string,
  ): Promise<void> {
    try {
      const index = pineconeClient.index(indexName);

      if (namespace) {
        await index.namespace(namespace).deleteOne(id);
      } else {
        await index.deleteOne(id);
      }

      console.log(`✓ Deleted vector: ${id}`);
    } catch (error) {
      console.error(`Failed to delete vector:`, error);
      throw error;
    }
  }

  /**
   * 벡터 삭제 (여러 ID)
   * @param indexName Pinecone 인덱스명
   * @param ids 삭제할 벡터 ID 배열
   * @param namespace 네임스페이스 (선택)
   */
  static async deleteMany(
    indexName: string,
    ids: string[],
    namespace?: string,
  ): Promise<void> {
    try {
      const index = pineconeClient.index(indexName);

      if (namespace) {
        await index.namespace(namespace).deleteMany(ids);
      } else {
        await index.deleteMany(ids);
      }

      console.log(`✓ Deleted ${ids.length} vectors`);
    } catch (error) {
      console.error(`Failed to delete vectors:`, error);
      throw error;
    }
  }

  /**
   * 메타데이터 필터로 벡터 삭제
   * @param indexName Pinecone 인덱스명
   * @param filter 메타데이터 필터
   * @param namespace 네임스페이스 (선택)
   */
  static async deleteByMetadata(
    indexName: string,
    filter: TPineconeMetadata,
    namespace?: string,
  ): Promise<void> {
    try {
      const index = pineconeClient.index(indexName);

      if (namespace) {
        await index.namespace(namespace).deleteMany(filter);
      } else {
        await index.deleteMany(filter);
      }

      console.log(`✓ Deleted vectors matching filter:`, filter);
    } catch (error) {
      console.error(`Failed to delete vectors by metadata:`, error);
      throw error;
    }
  }

  /**
   * 네임스페이스 전체 삭제
   * @param indexName Pinecone 인덱스명
   * @param namespace 네임스페이스
   */
  static async deleteAll(indexName: string, namespace?: string): Promise<void> {
    try {
      const index = pineconeClient.index(indexName);

      if (namespace) {
        await index.namespace(namespace).deleteAll();
      } else {
        await index.deleteAll();
      }

      console.log(
        `✓ Deleted all vectors${namespace ? ` in namespace: ${namespace}` : ""}`,
      );
    } catch (error) {
      console.error(`Failed to delete all vectors:`, error);
      throw error;
    }
  }

  /**
   * 벡터 메타데이터만 업데이트
   * @param indexName Pinecone 인덱스명
   * @param id 벡터 ID
   * @param metadata 새로운 메타데이터
   * @param namespace 네임스페이스 (선택)
   */
  static async updateMetadata(
    indexName: string,
    id: string,
    metadata: TPineconeMetadata,
    namespace?: string,
  ): Promise<void> {
    try {
      const index = pineconeClient.index(indexName);

      if (namespace) {
        await index.namespace(namespace).update({
          id,
          metadata,
        });
      } else {
        await index.update({
          id,
          metadata,
        });
      }

      console.log(`✓ Updated metadata for vector: ${id}`);
    } catch (error) {
      console.error(`Failed to update metadata:`, error);
      throw error;
    }
  }

  /**
   * 인덱스 통계 조회
   * @param indexName Pinecone 인덱스명
   * @returns 인덱스 통계
   */
  static async describeIndexStats(indexName: string): Promise<unknown> {
    try {
      const index = pineconeClient.index(indexName);
      const stats = await index.describeIndexStats();
      return stats;
    } catch (error) {
      console.error(`Failed to describe index stats:`, error);
      throw error;
    }
  }
}
