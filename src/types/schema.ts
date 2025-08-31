import { ValidationResult, ValidationError } from './base.js';

/**
 * バリデーションルールの定義
 */
export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  maxLength?: number;
  minLength?: number;
  max?: number;
  min?: number;
  enum?: string[] | number[];
  default?: any;
  pattern?: RegExp;
  custom?: (value: any) => ValidationError | null;
}

/**
 * フィールドバリデーション結果
 */
export interface FieldValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  value: any;
}

/**
 * スキーマインターフェース
 */
export interface SchemaInterface<T> {
  validationRules: Record<keyof T, ValidationRule>;
  
  // バリデーション機能
  validate(data: unknown): ValidationResult<T>;
  validateField(fieldName: keyof T, value: unknown): FieldValidationResult;
  
  // 設定
  setStrictMode(enabled: boolean): void;
  isStrictMode(): boolean;
  
  // ユーティリティ
  getValidationRules(): Record<keyof T, ValidationRule>;
  formatErrors(errors: ValidationError[]): string;
  
  // データ変換
  sanitizeData(data: any): Partial<T>;
  setDefaults(data: Partial<T>): Partial<T>;
}

/**
 * スキーマ設定オプション
 */
export interface SchemaOptions {
  strictMode?: boolean;
  allowUnknownFields?: boolean;
  stripUnknownFields?: boolean;
  customErrorMessages?: Record<string, string>;
}

