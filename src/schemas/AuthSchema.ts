import { BaseSchema } from '../base/BaseSchema.js';
import { ValidationRule } from '../types/schema.js';
import { ValidationError } from '../types/base.js';
import { AuthCreateData } from '../types/auth.js';
import { validatePasswordStrength, isCommonPassword } from '../utils/passwordStrength.js';

/**
 * 認証スキーマクラス
 * 認証データのバリデーションを担当
 */
export class AuthSchema extends BaseSchema<AuthCreateData> {
  public validationRules: Record<keyof AuthCreateData, ValidationRule> = {
    username: {
      required: true,
      type: 'string',
      maxLength: 50,
      minLength: 3,
      pattern: /^[a-zA-Z0-9_]+$/, // 英数字とアンダースコアのみ
      custom: (value: string) => {
        // 予約語チェック
        const reservedWords = ['admin', 'system', 'bot', 'null', 'undefined', 'root', 'user'];
        if (reservedWords.includes(value.toLowerCase())) {
          return {
            field: 'username',
            message: 'このユーザー名は予約語のため使用できません'
          };
        }

        // ユーザー名の先頭は文字である必要がある
        if (!/^[a-zA-Z]/.test(value)) {
          return {
            field: 'username',
            message: 'ユーザー名は文字で始める必要があります'
          };
        }

        return null;
      }
    },
    password: {
      required: true,
      type: 'string',
      maxLength: 100,
      minLength: 6,
      custom: (value: string) => {
        // パスワード強度チェック
        const strengthValidation = validatePasswordStrength(value);
        if (!strengthValidation.isValid) {
          return {
            field: 'password',
            message: strengthValidation.message || 'パスワードの強度が不十分です'
          };
        }

        // 一般的なパスワードのチェック
        if (isCommonPassword(value)) {
          return {
            field: 'password',
            message: 'このパスワードは一般的すぎます。より安全なパスワードを選択してください'
          };
        }

        return null;
      }
    }
  };



  /**
   * ユーザー名の利用可能性チェック
   */
  validateUsernameAvailability(username: string): { isValid: boolean; message?: string } {
    // 長さチェック
    if (username.length < 3) {
      return { isValid: false, message: 'ユーザー名は3文字以上である必要があります' };
    }

    if (username.length > 50) {
      return { isValid: false, message: 'ユーザー名は50文字以下である必要があります' };
    }

    // 文字制限チェック
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return { isValid: false, message: 'ユーザー名は英数字とアンダースコアのみ使用可能です' };
    }

    // 先頭文字チェック
    if (!/^[a-zA-Z]/.test(username)) {
      return { isValid: false, message: 'ユーザー名は文字で始める必要があります' };
    }

    return { isValid: true };
  }



  /**
   * 登録データのバリデーション
   */
  validateRegistration(data: any): {
    isValid: boolean;
    errors: ValidationError[];
  } {
    return this.validate(data);
  }

  /**
   * ログインデータのバリデーション
   */
  validateLogin(data: any): { isValid: boolean; errors: ValidationError[] } {
    const errors: ValidationError[] = [];

    if (!data.username || typeof data.username !== 'string' || data.username.trim().length === 0) {
      errors.push({ field: 'username', message: 'ユーザー名は必須です' });
    }

    if (!data.password || typeof data.password !== 'string' || data.password.length === 0) {
      errors.push({ field: 'password', message: 'パスワードは必須です' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// シングルトンインスタンス
export const authSchema = new AuthSchema({
  strictMode: true,
  allowUnknownFields: false,
  stripUnknownFields: true,
  customErrorMessages: {
    'username_required': 'ユーザー名は必須です',
    'password_required': 'パスワードは必須です',
    'username_minLength': 'ユーザー名は3文字以上である必要があります',
    'username_maxLength': 'ユーザー名は50文字以下である必要があります',
    'password_minLength': 'パスワードは6文字以上である必要があります',
    'password_maxLength': 'パスワードは100文字以下である必要があります',
    'username_pattern': 'ユーザー名は英数字とアンダースコアのみ使用可能です',
    'invalid_data_format': '無効なデータ形式です',
    'unknown_fields': '許可されていないフィールドが含まれています'
  }
});

export default authSchema;
