import { 
  SchemaInterface, 
  ValidationRule, 
  FieldValidationResult, 
  SchemaOptions 
} from '../types/schema.js';
import { ValidationResult, ValidationError } from '../types/base.js';

/**
 * 抽象基盤Schemaクラス
 * 全てのスキーマ実装で共通するバリデーション機能を提供
 */
export abstract class BaseSchema<T> implements SchemaInterface<T> {
  public abstract validationRules: Record<keyof T, ValidationRule>;
  
  protected strictMode: boolean = true;
  protected allowUnknownFields: boolean = false;
  protected stripUnknownFields: boolean = true;
  protected customErrorMessages: Record<string, string> = {};

  constructor(options: SchemaOptions = {}) {
    this.strictMode = options.strictMode ?? true;
    this.allowUnknownFields = options.allowUnknownFields ?? false;
    this.stripUnknownFields = options.stripUnknownFields ?? true;
    this.customErrorMessages = options.customErrorMessages ?? {};
  }

  /**
   * データ全体のバリデーション
   */
  validate(data: unknown): ValidationResult<T> {
    const errors: ValidationError[] = [];
    const sanitizedData: Partial<T> = {};

    // データ形式の基本チェック
    if (!data || typeof data !== 'object') {
      errors.push({
        field: 'data',
        message: this.getErrorMessage('invalid_data_format', 'Invalid data format')
      });
      return { isValid: false, errors, data: null };
    }

    const inputData = data as Record<string, any>;
    const allowedFields = Object.keys(this.validationRules) as (keyof T)[];
    const receivedFields = Object.keys(inputData);

    // 未知フィールドの処理
    const unknownFields = receivedFields.filter(field => !allowedFields.includes(field as keyof T));
    if (unknownFields.length > 0) {
      if (!this.allowUnknownFields) {
        errors.push({
          field: 'unknown_fields',
          message: this.getErrorMessage(
            'unknown_fields', 
            `Unknown fields detected: ${unknownFields.join(', ')}. Allowed fields: ${allowedFields.join(', ')}`
          )
        });
      }
      
      // フィールド名の類似性チェック（タイポ検出）
      this.checkForTypos(unknownFields, allowedFields, errors);
    }

    // 早期リターン（未知フィールドエラーがある場合）
    if (errors.length > 0 && this.strictMode) {
      return { isValid: false, errors, data: null };
    }

    // 各フィールドのバリデーション
    for (const fieldName of allowedFields) {
      const fieldValue = inputData[fieldName as string];
      const fieldValidation = this.validateField(fieldName, fieldValue);
      
      if (!fieldValidation.isValid) {
        errors.push(...fieldValidation.errors);
      } else if (fieldValidation.value !== undefined) {
        sanitizedData[fieldName] = fieldValidation.value;
      }
    }

    // デフォルト値の設定
    const dataWithDefaults = this.setDefaults(sanitizedData);

    return {
      isValid: errors.length === 0,
      errors,
      data: errors.length === 0 ? dataWithDefaults as T : null
    };
  }

  /**
   * 個別フィールドのバリデーション
   */
  validateField(fieldName: keyof T, value: unknown): FieldValidationResult {
    const rule = this.validationRules[fieldName];
    const errors: ValidationError[] = [];

    // 必須チェック
    if (rule.required && this.isEmpty(value)) {
      errors.push({
        field: fieldName as string,
        message: this.getErrorMessage(
          `${fieldName as string}_required`,
          `${fieldName as string} is required`
        )
      });
      return { isValid: false, errors, value: null };
    }

    // 空値の場合はデフォルト値を返す
    if (this.isEmpty(value)) {
      return { 
        isValid: true, 
        errors: [], 
        value: rule.default !== undefined ? rule.default : undefined 
      };
    }

    // 型チェック
    const typeValidation = this.validateType(fieldName, value, rule);
    if (!typeValidation.isValid) {
      return typeValidation;
    }

    // 値の検証（長さ、範囲、enum等）
    const valueValidation = this.validateValue(fieldName, typeValidation.value, rule);
    if (!valueValidation.isValid) {
      return valueValidation;
    }

    // カスタムバリデーション
    if (rule.custom) {
      const customError = rule.custom(valueValidation.value);
      if (customError) {
        errors.push(customError);
        return { isValid: false, errors, value: null };
      }
    }

    return { isValid: true, errors: [], value: valueValidation.value };
  }

  /**
   * 型バリデーション
   */
  private validateType(fieldName: keyof T, value: unknown, rule: ValidationRule): FieldValidationResult {
    const errors: ValidationError[] = [];

    if (!rule.type) {
      return { isValid: true, errors: [], value };
    }

    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push({
            field: fieldName as string,
            message: `${fieldName as string} must be a string`
          });
        }
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          errors.push({
            field: fieldName as string,
            message: `${fieldName as string} must be a valid number`
          });
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push({
            field: fieldName as string,
            message: `${fieldName as string} must be a boolean`
          });
        }
        break;
      case 'date':
        if (!(value instanceof Date) && typeof value !== 'string') {
          errors.push({
            field: fieldName as string,
            message: `${fieldName as string} must be a date`
          });
        } else if (typeof value === 'string') {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            errors.push({
              field: fieldName as string,
              message: `${fieldName as string} must be a valid date`
            });
          } else {
            value = date;
          }
        }
        break;
    }

    return { isValid: errors.length === 0, errors, value };
  }

  /**
   * 値の範囲・制約バリデーション
   */
  private validateValue(fieldName: keyof T, value: any, rule: ValidationRule): FieldValidationResult {
    const errors: ValidationError[] = [];

    // 文字列の場合
    if (typeof value === 'string') {
      const trimmedValue = value.trim();
      
      if (rule.minLength && trimmedValue.length < rule.minLength) {
        errors.push({
          field: fieldName as string,
          message: `${fieldName as string} must be at least ${rule.minLength} characters long`
        });
      }
      
      if (rule.maxLength && trimmedValue.length > rule.maxLength) {
        errors.push({
          field: fieldName as string,
          message: `${fieldName as string} must be at most ${rule.maxLength} characters long`
        });
      }
      
      if (rule.pattern && !rule.pattern.test(trimmedValue)) {
        errors.push({
          field: fieldName as string,
          message: `${fieldName as string} format is invalid`
        });
      }
      
      if (rule.enum && !rule.enum.includes(trimmedValue)) {
        errors.push({
          field: fieldName as string,
          message: `${fieldName as string} must be one of: ${rule.enum.join(', ')}`
        });
      }
      
      value = trimmedValue;
    }

    // 数値の場合
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        errors.push({
          field: fieldName as string,
          message: `${fieldName as string} must be at least ${rule.min}`
        });
      }
      
      if (rule.max !== undefined && value > rule.max) {
        errors.push({
          field: fieldName as string,
          message: `${fieldName as string} must be at most ${rule.max}`
        });
      }
    }

    return { isValid: errors.length === 0, errors, value };
  }

  /**
   * 空値チェック
   */
  private isEmpty(value: unknown): boolean {
    return value === undefined || value === null || value === '';
  }

  /**
   * タイポチェック
   */
  private checkForTypos(unknownFields: string[], allowedFields: (keyof T)[], errors: ValidationError[]): void {
    const fieldSuggestions: Record<string, string> = {
      'ro': 'room',
      'typ': 'type',
      'msg': 'message',
      'user': 'username',
      'usr': 'username'
    };

    unknownFields.forEach(field => {
      if (fieldSuggestions[field]) {
        errors.push({
          field,
          message: `Did you mean '${fieldSuggestions[field]}' instead of '${field}'?`
        });
      }
    });
  }

  /**
   * エラーメッセージの取得
   */
  private getErrorMessage(key: string, defaultMessage: string): string {
    return this.customErrorMessages[key] || defaultMessage;
  }

  // インターフェース実装
  setStrictMode(enabled: boolean): void {
    this.strictMode = enabled;
  }

  isStrictMode(): boolean {
    return this.strictMode;
  }

  getValidationRules(): Record<keyof T, ValidationRule> {
    return JSON.parse(JSON.stringify(this.validationRules));
  }

  formatErrors(errors: ValidationError[]): string {
    return errors.map(error => `${error.field}: ${error.message}`).join(', ');
  }

  sanitizeData(data: any): Partial<T> {
    const sanitized: Partial<T> = {};
    const allowedFields = Object.keys(this.validationRules) as (keyof T)[];
    
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        sanitized[field] = data[field];
      }
    }
    
    return sanitized;
  }

  setDefaults(data: Partial<T>): Partial<T> {
    const result = { ...data };
    
    for (const [fieldName, rule] of Object.entries(this.validationRules)) {
      if (rule.default !== undefined && result[fieldName as keyof T] === undefined) {
        result[fieldName as keyof T] = rule.default;
      }
    }
    
    return result;
  }
}
