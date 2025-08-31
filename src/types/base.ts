/**
 * 基本的なエンティティインターフェース
 */
export interface BaseEntity {
  _id: string;
  createdAt?: Date;
  updatedAt?: Date;
  timestamp?: Date;
}

/**
 * バリデーションエラーの定義
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * バリデーション結果の定義
 */
export interface ValidationResult<T> {
  isValid: boolean;
  errors: ValidationError[];
  data: T | null;
}

/**
 * 操作結果の定義
 */
export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: ValidationError[];
}

/**
 * クエリオプションの定義
 */
export interface QueryOptions {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  lean?: boolean;
}
