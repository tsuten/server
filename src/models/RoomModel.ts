import { Model } from 'mongoose';
import { RoomEntity, RoomType, RoomStatus } from '../types/room.js';
import { BaseModel, BaseDocument } from '../base/BaseModel.js';

/**
 * MongooseドキュメントとRoomEntityを結合した型
 */
export interface RoomDocument extends RoomEntity, BaseDocument {
  _id: string;
}

/**
 * RoomModelクラス
 * BaseModelを継承してRoom固有の機能を実装
 */
class RoomModelClass extends BaseModel<RoomDocument> {
  constructor() {
    // Room固有のスキーマ定義
    const roomSchemaDefinition = {
      name: {
        type: String,
        required: true,
        trim: true,
        maxLength: 100,
        minLength: 1,
        unique: true, // ルーム名はユニーク
        index: true
      },
      description: {
        type: String,
        trim: true,
        maxLength: 500,
        default: ''
      },
      type: {
        type: String,
        enum: ['channel', 'group', 'forum', 'general'] as RoomType[],
        default: 'general' as RoomType,
        index: true
      },
      status: {
        type: String,
        enum: ['active', 'archived'] as RoomStatus[],
        default: 'active' as RoomStatus,
        index: true
      },
      lastActivity: {
        type: Date,
        default: Date.now,
        index: true // アクティビティ検索用
      },
      messageCount: {
        type: Number,
        default: 0,
        min: 0
      },
      isDefault: {
        type: Boolean,
        default: false,
        index: true // デフォルトルーム検索用
      }
    };

    // BaseModelのコンストラクタを呼び出し
    super('Room', roomSchemaDefinition, 'rooms');

    // Room固有のインデックスを追加
    this.addRoomIndexes();
    
    // Room固有のメソッドを追加
    this.addRoomMethods();
  }

  /**
   * Room固有のインデックスを追加
   */
  private addRoomIndexes(): void {
    // 複合インデックスの追加（検索パフォーマンス向上）
    this.addCustomIndex({ name: 1, type: 1 }); // 名前とタイプでの検索
    this.addCustomIndex({ type: 1, status: 1 }); // タイプとステータスでの検索
    this.addCustomIndex({ status: 1, lastActivity: -1 }); // ステータス別アクティビティ検索
    this.addCustomIndex({ isDefault: 1, status: 1 }); // デフォルトルーム検索
    
    // 全文検索用インデックス（オプション）
    this.addCustomIndex({ 
      name: 'text', 
      description: 'text' 
    }, { 
      weights: { name: 10, description: 5 },
      name: 'room_text_index'
    });
  }

  /**
   * Room固有のメソッドを追加
   */
  private addRoomMethods(): void {
    // アクティビティ更新メソッド
    this.addCustomMethod('updateActivity', function(this: RoomDocument) {
      this.lastActivity = new Date();
      return this.save();
    });

    // メッセージ数増加メソッド
    this.addCustomMethod('incrementMessageCount', function(this: RoomDocument) {
      this.messageCount = (this.messageCount || 0) + 1;
      this.lastActivity = new Date();
      return this.save();
    });

    // アーカイブメソッド
    this.addCustomMethod('archive', function(this: RoomDocument) {
      this.status = 'archived';
      return this.save();
    });

    // アクティブ化メソッド
    this.addCustomMethod('activate', function(this: RoomDocument) {
      this.status = 'active';
      return this.save();
    });
  }
}

// 拡張されたRoomDocumentインターフェース（カスタムメソッド含む）
export interface ExtendedRoomDocument extends RoomDocument {
  updateActivity(): Promise<RoomDocument>;
  incrementMessageCount(): Promise<RoomDocument>;
  archive(): Promise<RoomDocument>;
  activate(): Promise<RoomDocument>;
}

// モデル型の定義（操作メソッドは含まない）
export interface RoomModel extends Model<RoomDocument> {}

// シングルトンインスタンスを作成
const roomModelInstance = new RoomModelClass();

// モデルの作成とエクスポート
export const RoomModel = roomModelInstance.getModel() as RoomModel;

export default RoomModel;
