import { BaseEntity, ValidationResult, OperationResult, QueryOptions } from './base.js';

/**
 * 汎用的なOperation基盤インターフェース
 * 全てのエンティティ操作で共通するCRUD操作を定義
 */
export interface BaseOperationInterface<
  T extends BaseEntity,
  CreateData,
  UpdateData
> {
  // 基本CRUD操作
  create(data: CreateData): Promise<OperationResult<T>>;
  findById(id: string): Promise<OperationResult<T>>;
  update(id: string, data: UpdateData): Promise<OperationResult<T>>;
  delete(id: string): Promise<OperationResult<T>>;
  
  // リスト操作
  findMany(query?: Partial<T>, options?: QueryOptions): Promise<OperationResult<T[]>>;
  count(query?: Partial<T>): Promise<OperationResult<number>>;
  
  // バリデーション
  validate(data: unknown): ValidationResult<CreateData>;
}

/**
 * ページネーション結果の定義
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * 検索オプションの定義
 */
export interface SearchOptions extends QueryOptions {
  keyword?: string;
  fields?: string[];
  caseSensitive?: boolean;
}
