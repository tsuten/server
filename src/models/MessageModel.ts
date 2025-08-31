import { Model } from 'mongoose';
import { MessageEntity, MessageType } from '../types/message.js';
import { BaseModel, BaseDocument } from '../base/BaseModel.js';

/**
 * MongooseドキュメントとMessageEntityを結合した型
 */
export interface MessageDocument extends MessageEntity, BaseDocument {
  _id: string;
}

/**
 * MessageModelクラス
 * BaseModelを継承してMessage固有の機能を実装
 */
class MessageModelClass extends BaseModel<MessageDocument> {
  constructor() {
    // Message固有のスキーマ定義
    const messageSchemaDefinition = {
      message: {
        type: String,
        required: true,
        trim: true,
        maxLength: 1000,
        minLength: 1
      },
      username: {
        type: String,
        required: true,
        trim: true,
        maxLength: 50,
        minLength: 1
      },
      room: {
        type: String,
        default: 'general',
        trim: true,
        maxLength: 100,
        index: true // room別検索のパフォーマンス向上
      },
      type: {
        type: String,
        enum: ['text', 'system', 'notification'] as MessageType[],
        default: 'text' as MessageType
      }
    };

    // BaseModelのコンストラクタを呼び出し
    super('Message', messageSchemaDefinition, 'messages');

    // Message固有のインデックスを追加
    this.addMessageIndexes();
  }

  /**
   * Message固有のインデックスを追加
   */
  private addMessageIndexes(): void {
    // 複合インデックスの追加（検索パフォーマンス向上）
    this.addCustomIndex({ room: 1, timestamp: -1 }); // room別の時系列検索
    this.addCustomIndex({ username: 1, timestamp: -1 }); // ユーザー別の時系列検索
    this.addCustomIndex({ type: 1 }); // タイプ別検索
    this.addCustomIndex({ message: 'text' }); // 全文検索用（オプション）
  }
}

// モデル型の定義（操作メソッドは含まない）
export interface MessageModel extends Model<MessageDocument> {}

// シングルトンインスタンスを作成
const messageModelInstance = new MessageModelClass();

// モデルの作成とエクスポート
export const MessageModel = messageModelInstance.getModel() as MessageModel;

export default MessageModel;
