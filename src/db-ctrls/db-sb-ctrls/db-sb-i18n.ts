import {
  SQL_DB_TABLE,
  ResponseDBSelect,
  TCountry,
  TCountryLanguage,
  TLanguage,
} from "aiqna_common_v1";

import sbdb from "../../config/supabase.js";

/**
 * DB Supabase I18n 클래스
 * 국가, 언어 정보 조회 기능 제공
 */
export default class DBSbI18n {
  /**
   * 모든 언어 정보를 조회하는 기능
   * @returns 언어 정보 목록
   * @throws {Error} 조회 중 오류가 발생한 경우 오류 객체 반환
   */
  static async selectAllLanguages(): Promise<ResponseDBSelect<TLanguage[]>> {
    try {
      const { data, error } = await sbdb
        .from(SQL_DB_TABLE.languages)
        .select("*");

      if (error) {
        throw new Error(
          `#1 DB Supabase I18n 모든 언어 목록 조회 중 오류 발생: ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(
          `#2 DB Supabase I18n 모든 언어 목록 조회 중 오류 발생: ${error.message}`,
        );
      }
      throw new Error(
        "#3 DB Supabase I18n 모든 언어 목록 조회 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * 모든 국가 정보를 조회하는 기능
   * @returns {Promise<{ data: Country[] }>} 도시 정보 목록과 총 개수
   * @throws {Error} 조회 중 오류가 발생한 경우 오류 객체 반환
   */
  static async selectAllCountries(): Promise<ResponseDBSelect<TCountry[]>> {
    try {
      const { data, error } = await sbdb
        .from(SQL_DB_TABLE.countries)
        .select("*");

      if (error) {
        throw new Error(
          `#1 DB Supabase I18n 모든 국가 목록 조회 중 오류 발생: ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(
          `#2 DB Supabase I18n 모든 국가 목록 조회 중 오류 발생: ${error.message}`,
        );
      }
      throw new Error(
        "#3 DB Supabase I18n 모든 국가 목록 조회 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * 모든 국가 언어 정보를 조회하는 기능
   * @returns 국가 언어 정보 목록
   * @throws {Error} 조회 중 오류가 발생한 경우 오류 객체 반환
   */
  static async selectAllCountryLanguages(): Promise<
    ResponseDBSelect<TCountryLanguage[]>
  > {
    try {
      const { data, error } = await sbdb
        .from(SQL_DB_TABLE.map_country_languages)
        .select("*");

      if (error) {
        throw new Error(
          `#1 DB Supabase I18n 모든 국가 언어 목록 조회 중 오류 발생: ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(
          `#2 DB Supabase I18n 모든 국가 언어 목록 조회 중 오류 발생: ${error.message}`,
        );
      }
      throw new Error(
        "#3 DB Supabase I18n 모든 국가 언어 목록 조회 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }
}
