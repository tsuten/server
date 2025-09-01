import { Model } from 'mongoose';
import { ChannelEntity, ChannelType } from '../types/channel.js';
import { BaseModel, BaseDocument } from '../base/BaseModel.js';

/**
 * MongooseドキュメントとChannelEntityを結合した型
 */
export interface ChannelDocument extends ChannelEntity, BaseDocument {
  _id: string;
}

/**
 * ChannelModelクラス
 * BaseModelを継承してChannel固有の機能を実装
 */
class ChannelModelClass extends BaseModel<ChannelDocument> {
  constructor() {
    // Channel固有のスキーマ定義
    const channelSchemaDefinition = {
      name: {
        type: String,
        required: true,
        trim: true,
        maxLength: 100,
        minLength: 1
      },
      type: {
        type: String,
        enum: Object.values(ChannelType),
        required: true,
        default: ChannelType.TEXT
      },
      description: {
        type: String,
        trim: true,
        maxLength: 500
      },
      room: {
        type: String,
        required: true,
        trim: true,
        maxLength: 100,
        index: true // room別検索のパフォーマンス向上
      },
      parentId: {
        type: String,
        trim: true,
        maxLength: 100,
        index: true // 親チャンネル検索用
      },
      position: {
        type: Number,
        required: true,
        default: 0,
        min: 0
      },
      isPrivate: {
        type: Boolean,
        required: true,
        default: false,
        index: true // プライベートチャンネル検索用
      },
      allowedUsers: [{
        type: String,
        trim: true
      }],
      settings: {
        slowMode: {
          type: Number,
          min: 0,
          max: 3600 // 最大1時間
        },
        maxUsers: {
          type: Number,
          min: 1,
          max: 1000
        },
        autoDelete: {
          type: Boolean,
          default: false
        },
        autoDeleteAfter: {
          type: Number,
          min: 1,
          max: 10080 // 最大1週間（分）
        },
        allowFileUpload: {
          type: Boolean,
          default: true
        },
        maxFileSize: {
          type: Number,
          min: 1,
          max: 100 // 最大100MB
        }
      }
    };

    // BaseModelのコンストラクタを呼び出し
    super('Channel', channelSchemaDefinition, 'channels');

    // Channel固有のインデックスを追加
    this.addChannelIndexes();
  }

  /**
   * Channel固有のインデックスを追加
   */
  private addChannelIndexes(): void {
    // 複合インデックスの追加（検索パフォーマンス向上）
    this.addCustomIndex({ room: 1, position: 1 }); // room別の位置順検索
    this.addCustomIndex({ room: 1, type: 1 }); // room別のタイプ検索
    this.addCustomIndex({ parentId: 1, position: 1 }); // 親チャンネル別の位置順検索
    this.addCustomIndex({ room: 1, isPrivate: 1 }); // room別のプライベート検索
    this.addCustomIndex({ name: 'text' }); // 全文検索用
    this.addCustomIndex({ type: 1 }); // タイプ別検索
    this.addCustomIndex({ allowedUsers: 1 }); // ユーザーアクセス検索用
  }
}

// モデル型の定義（操作メソッドは含まない）
export interface ChannelModel extends Model<ChannelDocument> {}

// シングルトンインスタンスを作成
const channelModelInstance = new ChannelModelClass();

// モデルの作成とエクスポート
export const ChannelModel = channelModelInstance.getModel() as ChannelModel;

export default ChannelModel;
