import { BaseSchema } from '../base/BaseSchema.js';
import { ValidationRule } from '../types/schema.js';
import { ValidationError } from '../types/base.js';
import { UserCreateData, UserType } from '../types/user.js';

/**
 * ユーザースキーマクラス
 * ユーザーデータのバリデーションを担当
 */
export class UserSchema extends BaseSchema<UserCreateData> {
  public validationRules: Record<keyof UserCreateData, ValidationRule> = {
    authId: {
      required: true,
      type: 'string',
      maxLength: 100,
      minLength: 1,
    },
    displayName: {
      required: true,
      type: 'string',
      maxLength: 50,
      minLength: 1,
      pattern: /^[a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s_-]+$/, // 英数字、ひらがな、カタカナ、漢字、スペース、アンダースコア、ハイフン
      custom: (value: string) => {
        // 表示名の先頭と末尾の空白チェック
        if (value !== value.trim()) {
          return {
            field: 'displayName',
            message: '表示名の先頭と末尾に空白を含めることはできません'
          };
        }

        // 連続する空白チェック
        if (/\s{2,}/.test(value)) {
          return {
            field: 'displayName',
            message: '表示名に連続する空白を含めることはできません'
          };
        }

        return null;
      }
    },
    email: {
      required: false,
      type: 'string',
      maxLength: 255,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // 基本的なメールアドレス形式
      custom: (value: string) => {
        if (value && value.length > 0) {
          // メールアドレスの詳細バリデーション
          const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
          if (!emailRegex.test(value)) {
            return {
              field: 'email',
              message: '有効なメールアドレスを入力してください'
            };
          }
        }
        return null;
      }
    },
    avatar: {
      required: false,
      type: 'string',
      maxLength: 500,
      custom: (value: string) => {
        if (value && value.length > 0) {
          // URL形式のチェック
          try {
            new URL(value);
          } catch {
            return {
              field: 'avatar',
              message: 'アバターは有効なURLである必要があります'
            };
          }
        }
        return null;
      }
    },
    type: {
      required: false,
      type: 'string',
      custom: (value: string) => {
        const validTypes: UserType[] = ['admin', 'moderator', 'user', 'guest'];
        if (value && !validTypes.includes(value as UserType)) {
          return {
            field: 'type',
            message: '無効なユーザータイプです'
          };
        }
        return null;
      }
    },
    settings: {
      required: false,
      type: 'object',
      custom: (value: any) => {
        if (value && typeof value === 'object') {
          // 設定オブジェクトのバリデーション
          if (value.private !== undefined && typeof value.private !== 'boolean') {
            return {
              field: 'settings.private',
              message: 'プライベート設定は真偽値である必要があります'
            };
          }
          
          if (value.notifications !== undefined && typeof value.notifications !== 'boolean') {
            return {
              field: 'settings.notifications',
              message: '通知設定は真偽値である必要があります'
            };
          }
          
          if (value.theme && !['light', 'dark', 'auto'].includes(value.theme)) {
            return {
              field: 'settings.theme',
              message: 'テーマは light、dark、auto のいずれかである必要があります'
            };
          }
          
          if (value.language && typeof value.language !== 'string') {
            return {
              field: 'settings.language',
              message: '言語設定は文字列である必要があります'
            };
          }
        }
        return null;
      }
    }
  };

  /**
   * 表示名の利用可能性チェック
   */
  validateDisplayNameAvailability(displayName: string): { isValid: boolean; message?: string } {
    // 長さチェック
    if (displayName.length < 1) {
      return { isValid: false, message: '表示名は1文字以上である必要があります' };
    }

    if (displayName.length > 50) {
      return { isValid: false, message: '表示名は50文字以下である必要があります' };
    }

    // 文字制限チェック
    if (!/^[a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s_-]+$/.test(displayName)) {
      return { isValid: false, message: '表示名に使用できない文字が含まれています' };
    }

    return { isValid: true };
  }

  /**
   * メールアドレスの利用可能性チェック
   */
  validateEmailAvailability(email: string): { isValid: boolean; message?: string } {
    if (!email || email.length === 0) {
      return { isValid: true }; // メールアドレスは任意
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(email)) {
      return { isValid: false, message: '有効なメールアドレスを入力してください' };
    }

    return { isValid: true };
  }
}

// シングルトンインスタンス
export const userSchema = new UserSchema({
  strictMode: true,
  allowUnknownFields: false,
  stripUnknownFields: true,
  customErrorMessages: {
    'authId_required': '認証IDは必須です',
    'displayName_required': '表示名は必須です',
    'displayName_minLength': '表示名は1文字以上である必要があります',
    'displayName_maxLength': '表示名は50文字以下である必要があります',
    'displayName_pattern': '表示名に使用できない文字が含まれています',
    'email_pattern': '有効なメールアドレスを入力してください',
    'avatar_pattern': 'アバターは有効なURLである必要があります',
    'invalid_data_format': '無効なデータ形式です',
    'unknown_fields': '許可されていないフィールドが含まれています'
  }
});

export default userSchema;
