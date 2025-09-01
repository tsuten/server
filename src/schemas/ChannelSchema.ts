import { BaseSchema } from '../base/BaseSchema.js';
import { ValidationRule } from '../types/schema.js';
import { ValidationError } from '../types/base.js';
import { ChannelCreateData, ChannelType } from '../types/channel.js';

/**
 * チャンネルスキーマクラス
 * チャンネルデータのバリデーションを担当
 */
export class ChannelSchema extends BaseSchema<ChannelCreateData> {
  public validationRules: Record<keyof ChannelCreateData, ValidationRule> = {
    name: {
      required: true,
      type: 'string',
      maxLength: 100,
      minLength: 1,
      pattern: /^[a-zA-Z0-9_\-\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/, // 英数字、アンダースコア、ハイフン、日本語
      custom: (value: string) => {
        // 不適切なチャンネル名のチェック
        if (!this.validateChannelName(value)) {
          return {
            field: 'name',
            message: 'チャンネル名に不適切な内容が含まれています'
          };
        }
        
        // 予約語チェック
        const reservedWords = ['admin', 'system', 'bot', 'api', 'null', 'undefined', 'config', 'general'];
        if (reservedWords.includes(value.toLowerCase().trim())) {
          return {
            field: 'name',
            message: 'このチャンネル名は使用できません'
          };
        }

        // チャンネル名の先頭と末尾の空白チェック
        if (value !== value.trim()) {
          return {
            field: 'name',
            message: 'チャンネル名の先頭と末尾に空白を含めることはできません'
          };
        }
        
        return null;
      }
    },
    type: {
      required: true,
      type: 'string',
      enum: Object.values(ChannelType),
      default: ChannelType.TEXT,
      custom: (value: ChannelType) => {
        if (!Object.values(ChannelType).includes(value)) {
          return {
            field: 'type',
            message: '無効なチャンネルタイプです'
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
    room: {
      required: true,
      type: 'string',
      maxLength: 100,
      minLength: 1,
      pattern: /^[a-zA-Z0-9_\-\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/,
      custom: (value: string) => {
        // ルーム名の存在チェック（将来的にデータベースから確認）
        if (!this.validateRoomName(value)) {
          return {
            field: 'room',
            message: '指定されたルームが存在しません'
          };
        }
        return null;
      }
    },
    parentId: {
      required: false,
      type: 'string',
      maxLength: 100,
      minLength: 1,
      custom: (value: string) => {
        if (value && !this.validateParentId(value)) {
          return {
            field: 'parentId',
            message: '無効な親チャンネルIDです'
          };
        }
        return null;
      }
    },
    position: {
      required: false,
      type: 'number',
      min: 0,
      max: 1000,
      custom: (value: number) => {
        if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
          return {
            field: 'position',
            message: '位置は0以上の整数である必要があります'
          };
        }
        return null;
      }
    },
    isPrivate: {
      required: false,
      type: 'boolean',
      default: false,
      custom: (value: boolean) => {
        if (typeof value !== 'boolean') {
          return {
            field: 'isPrivate',
            message: 'isPrivateはboolean型である必要があります'
          };
        }
        return null;
      }
    },
    allowedUsers: {
      required: false,
      type: 'array',
      custom: (value: string[]) => {
        if (value && !Array.isArray(value)) {
          return {
            field: 'allowedUsers',
            message: 'allowedUsersは配列である必要があります'
          };
        }
        
        if (value && value.length > 0) {
          // 各ユーザーIDの形式チェック
          for (const userId of value) {
            if (typeof userId !== 'string' || userId.trim().length === 0) {
              return {
                field: 'allowedUsers',
                message: 'ユーザーIDは空でない文字列である必要があります'
              };
            }
          }
          
          // 重複チェック
          const uniqueUsers = new Set(value);
          if (uniqueUsers.size !== value.length) {
            return {
              field: 'allowedUsers',
              message: 'ユーザーIDに重複があります'
            };
          }
        }
        
        return null;
      }
    },
    settings: {
      required: false,
      type: 'object',
      custom: (value: any) => {
        if (value && typeof value !== 'object') {
          return {
            field: 'settings',
            message: 'settingsはオブジェクトである必要があります'
          };
        }
        
        if (value) {
          const settingsErrors = this.validateChannelSettings(value);
          if (settingsErrors.length > 0) {
            return settingsErrors[0]; // 最初のエラーを返す
          }
        }
        
        return null;
      }
    }
  };

  /**
   * チャンネル名の内容検証
   */
  private validateChannelName(name: string): boolean {
    // 基本的な不適切な内容のチェック
    const inappropriatePatterns = [
      /spam/i,
      /test123/i,
      /delete/i,
      /admin/i,
      /system/i,
      /bot/i
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
   * ルーム名の検証
   */
  private validateRoomName(roomName: string): boolean {
    // 基本的な形式チェック
    if (!roomName || roomName.trim().length === 0) {
      return false;
    }
    
    // 許可されたルーム名のチェック（将来的にデータベースから取得）
    const allowedRooms = this.getAllowedRooms();
    return allowedRooms.includes(roomName);
  }

  /**
   * 親チャンネルIDの検証
   */
  private validateParentId(parentId: string): boolean {
    // 基本的な形式チェック
    if (!parentId || parentId.trim().length === 0) {
      return false;
    }
    
    // MongoDB ObjectId形式のチェック（簡易版）
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    return objectIdPattern.test(parentId);
  }

  /**
   * チャンネル設定の検証
   */
  private validateChannelSettings(settings: any): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // slowModeの検証
    if (settings.slowMode !== undefined) {
      if (typeof settings.slowMode !== 'number' || 
          !Number.isInteger(settings.slowMode) || 
          settings.slowMode < 0 || 
          settings.slowMode > 3600) {
        errors.push({
          field: 'settings.slowMode',
          message: 'slowModeは0から3600の整数である必要があります'
        });
      }
    }
    
    // maxUsersの検証
    if (settings.maxUsers !== undefined) {
      if (typeof settings.maxUsers !== 'number' || 
          !Number.isInteger(settings.maxUsers) || 
          settings.maxUsers < 1 || 
          settings.maxUsers > 1000) {
        errors.push({
          field: 'settings.maxUsers',
          message: 'maxUsersは1から1000の整数である必要があります'
        });
      }
    }
    
    // autoDeleteの検証
    if (settings.autoDelete !== undefined && typeof settings.autoDelete !== 'boolean') {
      errors.push({
        field: 'settings.autoDelete',
        message: 'autoDeleteはboolean型である必要があります'
      });
    }
    
    // autoDeleteAfterの検証
    if (settings.autoDeleteAfter !== undefined) {
      if (typeof settings.autoDeleteAfter !== 'number' || 
          !Number.isInteger(settings.autoDeleteAfter) || 
          settings.autoDeleteAfter < 1 || 
          settings.autoDeleteAfter > 10080) {
        errors.push({
          field: 'settings.autoDeleteAfter',
          message: 'autoDeleteAfterは1から10080の整数である必要があります'
        });
      }
    }
    
    // allowFileUploadの検証
    if (settings.allowFileUpload !== undefined && typeof settings.allowFileUpload !== 'boolean') {
      errors.push({
        field: 'settings.allowFileUpload',
        message: 'allowFileUploadはboolean型である必要があります'
      });
    }
    
    // maxFileSizeの検証
    if (settings.maxFileSize !== undefined) {
      if (typeof settings.maxFileSize !== 'number' || 
          settings.maxFileSize < 1 || 
          settings.maxFileSize > 100) {
        errors.push({
          field: 'settings.maxFileSize',
          message: 'maxFileSizeは1から100の数値である必要があります'
        });
      }
    }
    
    return errors;
  }

  /**
   * 利用可能なルーム一覧の取得
   */
  getAllowedRooms(): string[] {
    // 将来的にデータベースから取得するなど
    return ['general', 'random', 'tech', 'help', 'announcements'];
  }

  /**
   * 利用可能なチャンネルタイプの取得
   */
  getChannelTypes(): ChannelType[] {
    return Object.values(ChannelType);
  }

  /**
   * プライベートチャンネル用の特別な検証
   */
  validatePrivateChannel(data: ChannelCreateData): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (data.isPrivate) {
      if (!data.allowedUsers || data.allowedUsers.length === 0) {
        errors.push({
          field: 'allowedUsers',
          message: 'プライベートチャンネルには最低1人のユーザーアクセスが必要です'
        });
      }
      
      if (data.type === ChannelType.CATEGORY) {
        errors.push({
          field: 'type',
          message: 'カテゴリチャンネルはプライベートにできません'
        });
      }
    }
    
    return errors;
  }

  /**
   * カテゴリチャンネル用の特別な検証
   */
  validateCategoryChannel(data: ChannelCreateData): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (data.type === ChannelType.CATEGORY) {
      if (data.isPrivate) {
        errors.push({
          field: 'isPrivate',
          message: 'カテゴリチャンネルはプライベートにできません'
        });
      }
      
      if (data.allowedUsers && data.allowedUsers.length > 0) {
        errors.push({
          field: 'allowedUsers',
          message: 'カテゴリチャンネルにはユーザーアクセス設定は不要です'
        });
      }
    }
    
    return errors;
  }

  /**
   * ボイスチャンネル用の特別な検証
   */
  validateVoiceChannel(data: ChannelCreateData): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (data.type === ChannelType.VOICE) {
      if (data.settings?.maxUsers && data.settings.maxUsers > 50) {
        errors.push({
          field: 'settings.maxUsers',
          message: 'ボイスチャンネルの最大ユーザー数は50人までです'
        });
      }
    }
    
    return errors;
  }

  /**
   * バリデーション実行
   * チャンネルタイプ別の特別な検証も含む
   */
  override validate(data: unknown): { isValid: boolean; errors: ValidationError[]; data: ChannelCreateData | null } {
    const result = super.validate(data);
    
    if (result.isValid && result.data) {
      const additionalErrors: ValidationError[] = [];
      
      // プライベートチャンネル用の追加検証
      additionalErrors.push(...this.validatePrivateChannel(result.data));
      
      // カテゴリチャンネル用の追加検証
      additionalErrors.push(...this.validateCategoryChannel(result.data));
      
      // ボイスチャンネル用の追加検証
      additionalErrors.push(...this.validateVoiceChannel(result.data));
      
      if (additionalErrors.length > 0) {
        return {
          isValid: false,
          errors: [...result.errors, ...additionalErrors],
          data: null
        };
      }
    }
    
    return result;
  }

  /**
   * チャンネル名の利用可能性チェック
   */
  validateChannelNameAvailability(name: string, room: string): { isValid: boolean; message?: string } {
    // 長さチェック
    if (name.length < 1) {
      return { isValid: false, message: 'チャンネル名は1文字以上である必要があります' };
    }

    if (name.length > 100) {
      return { isValid: false, message: 'チャンネル名は100文字以下である必要があります' };
    }

    // 文字制限チェック
    if (!/^[a-zA-Z0-9_\-\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(name)) {
      return { isValid: false, message: 'チャンネル名に使用できない文字が含まれています' };
    }

    // 予約語チェック
    const reservedWords = ['admin', 'system', 'bot', 'api', 'null', 'undefined', 'config', 'general'];
    if (reservedWords.includes(name.toLowerCase().trim())) {
      return { isValid: false, message: 'このチャンネル名は使用できません' };
    }

    return { isValid: true };
  }

  /**
   * イベント別のバリデーションルール取得
   */
  getValidationRulesForEvent(eventName: string): Record<keyof ChannelCreateData, ValidationRule> {
    const rules = { ...this.validationRules };
    
    switch (eventName) {
      case 'createChannel':
        // チャンネル作成時は全フィールド必須
        rules.name.required = true;
        rules.type.required = true;
        rules.room.required = true;
        break;
        
      case 'updateChannel':
        // チャンネル更新時は一部フィールドのみ
        rules.name.required = false;
        rules.type.required = false;
        rules.room.required = false;
        break;
        
      case 'moveChannel':
        // チャンネル移動時はparentIdのみ必要
        rules.name.required = false;
        rules.type.required = false;
        rules.room.required = false;
        rules.parentId.required = true;
        break;
    }
    
    return rules;
  }

  /**
   * チャンネル設定の推奨値取得
   */
  getRecommendedSettings(channelType: ChannelType): any {
    const defaultSettings = {
      slowMode: 0,
      autoDelete: false,
      allowFileUpload: true,
      maxFileSize: 10
    };

    switch (channelType) {
      case ChannelType.TEXT:
        return {
          ...defaultSettings,
          slowMode: 0,
          maxFileSize: 10
        };
        
      case ChannelType.VOICE:
        return {
          ...defaultSettings,
          maxUsers: 10,
          allowFileUpload: false
        };
        
      case ChannelType.CATEGORY:
        return {
          ...defaultSettings,
          allowFileUpload: false
        };
        
      case ChannelType.PRIVATE:
        return {
          ...defaultSettings,
          slowMode: 5,
          maxFileSize: 5
        };
        
      default:
        return defaultSettings;
    }
  }
}

// シングルトンインスタンス
export const channelSchema = new ChannelSchema({
  strictMode: true,
  allowUnknownFields: false,
  stripUnknownFields: true,
  customErrorMessages: {
    'name_required': 'チャンネル名は必須です',
    'type_required': 'チャンネルタイプは必須です',
    'room_required': 'ルームは必須です',
    'name_minLength': 'チャンネル名は1文字以上である必要があります',
    'name_maxLength': 'チャンネル名は100文字以下である必要があります',
    'description_maxLength': '説明文は500文字以下である必要があります',
    'position_min': '位置は0以上である必要があります',
    'position_max': '位置は1000以下である必要があります',
    'invalid_data_format': '無効なデータ形式です',
    'unknown_fields': '許可されていないフィールドが含まれています'
  }
});

export default channelSchema;
