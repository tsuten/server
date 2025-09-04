import { Model } from 'mongoose';
import { ServerEntity } from '../types/server.js';
import { BaseModel, BaseDocument } from '../base/BaseModel.js';

/**
 * MongooseドキュメントとServerEntityを結合した型
 */
export interface ServerDocument extends ServerEntity, BaseDocument {
  _id: string;
}

/**
 * ServerModelクラス
 * BaseModelを継承してServer固有の機能を実装
 */
class ServerModelClass extends BaseModel<ServerDocument> {
  constructor() {
    // Server固有のスキーマ定義
    const serverSchemaDefinition = {
      name: {
        type: String,
        required: true,
        trim: true,
        minLength: 1,
        maxLength: 100,
        index: true
      },
      slug: {
        type: String,
        required: false,
        trim: true,
        lowercase: true,
        unique: true,
        sparse: true,
        match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
      },
      description: {
        type: String,
        required: true,
        trim: true,
        maxLength: 500
      },
      logo: {
        type: String,
        required: false,
        trim: true
      },
      language: {
        type: String,
        required: false,
        trim: true,
        maxLength: 10,
        index: true
      },
      categories: [{
        type: String,
        trim: true,
        maxLength: 50
      }],
      settings: {
        type: {
          is_private: {
            type: Boolean,
            default: false
          },
          max_members: {
            type: Number,
            default: 1000,
            min: 1,
            max: 100000
          }
        },
        required: false,
        default: {
          is_private: false,
          max_members: 1000
        }
      }
    };

    // BaseModelのコンストラクタを呼び出し
    super('Server', serverSchemaDefinition, 'servers');

    // Server固有のインデックスを追加
    this.addServerIndexes();
  }

  /**
   * Server固有のインデックスを追加
   */
  private addServerIndexes(): void {
    this.addCustomIndex({ slug: 1 }, { unique: true, sparse: true });
    this.addCustomIndex({ name: 'text', description: 'text' }, {
      weights: { name: 10, description: 5 },
      name: 'server_text_index'
    });
    this.addCustomIndex({ language: 1 });
    this.addCustomIndex({ categories: 1 });
    this.addCustomIndex({ 'settings.is_private': 1 });
    this.addCustomIndex({ 'settings.max_members': 1 });
  }
}

// モデル型の定義（操作メソッドは含まない）
export interface ServerModel extends Model<ServerDocument> {}

// シングルトンインスタンスを作成
const serverModelInstance = new ServerModelClass();

// モデルの作成とエクスポート
export const ServerModel = serverModelInstance.getModel() as ServerModel;

export default ServerModel;

