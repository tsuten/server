import { BaseSchema } from '../base/BaseSchema.js';
import { ValidationRule } from '../types/schema.js';
import { ValidationError } from '../types/base.js';
import { MessageCreateData, MessageType } from '../types/message.js';

/**
 * メッセージスキーマクラス
 * メッセージデータのバリデーションを担当
 */
export class MessageSchema extends BaseSchema<MessageCreateData> {
  public validationRules: Record<keyof MessageCreateData, ValidationRule> = {
    message: {
      required: true,
      type: 'string',
      maxLength: 1000,
      minLength: 1,
      custom: (value: string) => {
        // 不適切な内容のチェック
        if (!this.validateMessageContent(value)) {
          return {
            field: 'message',
            message: 'メッセージに不適切な内容が含まれています'
          };
        }
        return null;
      }
    },
    senderId: {
      required: true,
      type: 'string',
      minLength: 1,
      custom: (value: string) => {
        // senderId の形式チェック（ObjectId形式など）
        if (!value || value.trim().length === 0) {
          return {
            field: 'senderId',
            message: 'senderIdは必須です'
          };
        }
        return null;
      }
    },
    channelId: {
      required: true,
      type: 'string',
      minLength: 1,
      custom: (value: string) => {
        // channelId の形式チェック（ObjectId形式など）
        if (!value || value.trim().length === 0) {
          return {
            field: 'channelId',
            message: 'channelIdは必須です'
          };
        }
        return null;
      }
    },
    type: {
      required: false,
      type: 'string',
      enum: ['text', 'system', 'notification'],
      default: 'text'
    }
  };

  /**
   * メッセージタイプの取得
   */
  getMessageTypes(): MessageType[] {
    return ['text', 'system', 'notification'];
  }

  /**
   * senderIdの必須設定を動的に変更
   * Socket接続時など、外部からsenderIdが設定される場合に使用
   */
  setSenderIdRequired(required: boolean): void {
    this.validationRules.senderId.required = required;
  }


  /**
   * メッセージ固有のカスタムバリデーション
   */
  protected validateMessageContent(content: string): boolean {
    // 不適切な内容のチェック
    const prohibitedWords = [
      'spam', 'abuse', 'hate', 'violence', 'threat',
      'scam', 'fraud', 'phishing', 'malware'
    ];
    const lowerContent = content.toLowerCase();
    
    // 禁止語句チェック
    if (prohibitedWords.some(word => lowerContent.includes(word))) {
      return false;
    }
    
    // 過度な大文字使用チェック
    const uppercaseRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (uppercaseRatio > 0.7 && content.length > 10) {
      return false;
    }
    
    // 同じ文字の連続チェック
    if (/(.)\1{4,}/.test(content)) {
      return false;
    }
    
    // URLスパムチェック（簡易版）
    const urlCount = (content.match(/https?:\/\/[^\s]+/gi) || []).length;
    if (urlCount > 2) {
      return false;
    }
    
    return true;
  }

  /**
   * イベント別のバリデーションルール取得
   */
  getValidationRulesForEvent(eventName: string): Record<keyof MessageCreateData, ValidationRule> {
    const rules = { ...this.validationRules };
    
    switch (eventName) {
      case 'sendMessage':
        // メッセージ送信時は全フィールド必須
        rules.senderId.required = true;
        rules.channelId.required = true;
        rules.message.required = true;
        break;
        
      case 'joinChannel':
      case 'leaveChannel':
        // チャンネル参加/退出時はsenderIdとchannelIdのみ必要
        rules.message.required = false;
        rules.senderId.required = true;
        rules.channelId.required = true;
        break;
        
      case 'searchMessages':
        // 検索時はkeywordが必要（別途処理）
        rules.message.required = false;
        rules.senderId.required = false;
        break;
    }
    
    return rules;
  }

  /**
   * レート制限チェック用のメソッド
   */
  checkRateLimit(senderId: string, eventName: string): { allowed: boolean; message?: string } {
    // 実際の実装では Redis などを使用してレート制限を実装
    // ここでは簡易的な実装例
    
    const rateLimits: Record<string, { maxRequests: number; windowMs: number }> = {
      'sendMessage': { maxRequests: 10, windowMs: 60000 }, // 1分間に10メッセージ
      'joinChannel': { maxRequests: 5, windowMs: 60000 }, // 1分間に5回まで
      'searchMessages': { maxRequests: 20, windowMs: 60000 } // 1分間に20回まで
    };
    
    const limit = rateLimits[eventName];
    if (!limit) {
      return { allowed: true };
    }
    
    // 実際の実装では外部ストレージを使用
    // ここでは常に許可として返す（実装例）
    return { allowed: true };
  }

  /**
   * メッセージの長さに基づく推奨設定
   */
  getRecommendedSettings(messageLength: number): { type: MessageType; priority?: number } {
    if (messageLength > 500) {
      return { type: 'text', priority: 1 }; // 長文は優先度低
    }
    
    return { type: 'text' };
  }
}

// シングルトンインスタンス
export const messageSchema = new MessageSchema({
  strictMode: true,
  allowUnknownFields: false,
  stripUnknownFields: true,
  customErrorMessages: {
    'message_required': 'メッセージ内容は必須です',
    'senderId_required': 'senderIdは必須です',
    'channelId_required': 'channelIdは必須です',
    'invalid_data_format': '無効なデータ形式です',
    'unknown_fields': '許可されていないフィールドが含まれています'
  }
});

export default messageSchema;

