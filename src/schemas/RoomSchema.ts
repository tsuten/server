import { BaseSchema } from '../base/BaseSchema.js';
import { ValidationRule } from '../types/schema.js';
import { ValidationError } from '../types/base.js';
import { RoomCreateData, RoomType } from '../types/room.js';

/**
 * ルームスキーマクラス
 * ルームデータのバリデーションを担当
 */
export class RoomSchema extends BaseSchema<RoomCreateData> {
  public validationRules: Record<keyof RoomCreateData, ValidationRule> = {
    name: {
      required: true,
      type: 'string',
      maxLength: 100,
      minLength: 1,
      pattern: /^[a-zA-Z0-9_\-\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/, // 英数字、アンダースコア、ハイフン、日本語
      custom: (value: string) => {
        // 不適切なルーム名のチェック
        if (!this.validateRoomName(value)) {
          return {
            field: 'name',
            message: 'ルーム名に不適切な内容が含まれています'
          };
        }
        
        // 予約語チェック
        const reservedWords = ['admin', 'system', 'bot', 'api', 'null', 'undefined', 'config'];
        if (reservedWords.includes(value.toLowerCase().trim())) {
          return {
            field: 'name',
            message: 'このルーム名は使用できません'
          };
        }
        
        return null;
      }
    },
    description: {
      required: false,
      type: 'string',
      maxLength: 500,
      minLength: 0,
      custom: (value: string) => {
        if (value && !this.validateDescription(value)) {
          return {
            field: 'description',
            message: '説明文に不適切な内容が含まれています'
          };
        }
        return null;
      }
    },
    type: {
      required: false,
      type: 'string',
      enum: ['channel', 'group', 'forum', 'general'],
      default: 'general'
    },
    isDefault: {
      required: false,
      type: 'boolean',
      default: false,
      custom: (value: boolean) => {
        // シンプルな型チェックのみ（複雑な検証はOperationレイヤーで行う）
        if (typeof value !== 'boolean') {
          return {
            field: 'isDefault',
            message: 'isDefaultはboolean型である必要があります'
          };
        }
        return null;
      }
    }
  };

  /**
   * ルーム名の内容検証
   */
  private validateRoomName(name: string): boolean {
    // 基本的な不適切な内容のチェック
    const inappropriatePatterns = [
      /spam/i,
      /test123/i,
      /delete/i,
      /admin/i
    ];
    
    return !inappropriatePatterns.some(pattern => pattern.test(name));
  }

  /**
   * 説明文の内容検証
   */
  private validateDescription(description: string): boolean {
    // 基本的な不適切な内容のチェック
    const inappropriatePatterns = [
      /spam/i,
      /\b(https?:\/\/[^\s]+)/gi // URLの制限（必要に応じて）
    ];
    
    return !inappropriatePatterns.some(pattern => pattern.test(description));
  }

  /**
   * 利用可能なルームタイプの取得
   */
  getRoomTypes(): RoomType[] {
    return ['channel', 'group', 'forum', 'general'];
  }

  /**
   * デフォルトルーム用の特別な検証
   */
  validateDefaultRoom(data: RoomCreateData): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (data.isDefault) {
      if (data.type !== 'general') {
        errors.push({
          field: 'type',
          message: 'デフォルトルームはgeneral型である必要があります'
        });
      }
      
      if (data.name.toLowerCase() !== 'general') {
        errors.push({
          field: 'name',
          message: 'デフォルトルームの名前は"general"である必要があります'
        });
      }
    }
    
    return errors;
  }

  /**
   * バリデーション実行
   * デフォルトルーム用の特別な検証も含む
   */
  override validate(data: unknown): { isValid: boolean; errors: ValidationError[]; data: RoomCreateData | null } {
    const result = super.validate(data);
    
    if (result.isValid && result.data) {
      // デフォルトルーム用の追加検証
      const defaultRoomErrors = this.validateDefaultRoom(result.data);
      if (defaultRoomErrors.length > 0) {
        return {
          isValid: false,
          errors: [...result.errors, ...defaultRoomErrors],
          data: null
        };
      }
    }
    
    return result;
  }
}

// シングルトンインスタンス
export const roomSchema = new RoomSchema();

export default roomSchema;
