import mongoose, { Schema, Document, Model, SchemaOptions } from 'mongoose';
import { BaseEntity } from '../types/base.js';

/**
 * 基本ドキュメントインターフェース
 * MongooseドキュメントとBaseEntityを結合
 */
export interface BaseDocument extends BaseEntity, Document {
  _id: string;
}

/**
 * 基本スキーマオプション
 */
export const baseSchemaOptions: SchemaOptions = {
  timestamps: true, // createdAt, updatedAtを自動追加
  versionKey: false, // __vフィールドを無効化
  toJSON: {
    transform: function(doc, ret: any) {
      // _idをstringに変換
      ret._id = ret._id.toString();
      // 不要なフィールドを削除
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    transform: function(doc, ret: any) {
      // _idをstringに変換
      ret._id = ret._id.toString();
      // 不要なフィールドを削除
      delete ret.__v;
      return ret;
    }
  }
};

/**
 * 基本スキーマフィールド定義
 */
export const baseSchemaFields = {
  timestamp: {
    type: Date,
    default: Date.now,
    index: true // 検索パフォーマンス向上
  }
};

/**
 * BaseModel抽象クラス
 * 全てのモデルの基盤となるクラス
 */
export abstract class BaseModel<T extends BaseDocument> {
  protected schema: Schema<T>;
  protected model: Model<T>;
  protected modelName: string;
  protected collectionName: string;

  constructor(
    modelName: string,
    schemaDefinition: Record<string, any>,
    collectionName?: string,
    additionalOptions?: SchemaOptions
  ) {
    this.modelName = modelName;
    this.collectionName = collectionName || modelName.toLowerCase() + 's';

    // 基本フィールドとカスタムフィールドをマージ
    const fullSchemaDefinition = {
      ...baseSchemaFields,
      ...schemaDefinition
    };

    // スキーマオプションをマージ
    const schemaOptions: SchemaOptions = {
      ...baseSchemaOptions,
      collection: this.collectionName,
      ...additionalOptions
    };

    // スキーマを作成
    this.schema = new Schema<T>(fullSchemaDefinition, schemaOptions as any);

    // 共通メソッドとミドルウェアを追加
    this.addCommonMethods();
    this.addCommonMiddleware();
    this.addCommonIndexes();

    // モデルを作成
    this.model = mongoose.model<T>(this.modelName, this.schema);
  }

  /**
   * 共通インスタンスメソッドを追加
   */
  private addCommonMethods(): void {
    // toJSONメソッドのオーバーライド
    this.schema.methods.toJSON = function(): BaseEntity {
      const obj = this.toObject();
      
      // _idを文字列として確実に型変換
      obj._id = obj._id.toString();
      
      // 不要なMongoose固有フィールドを削除
      delete obj.__v;
      
      return obj as BaseEntity;
    };

    // カスタムtoObjectメソッド
    this.schema.methods.toCleanObject = function(): BaseEntity {
      const obj = this.toObject();
      
      // _idを文字列として確実に型変換
      obj._id = obj._id.toString();
      
      // 不要なフィールドを削除
      delete obj.__v;
      delete obj.createdAt;
      delete obj.updatedAt;
      
      return obj as BaseEntity;
    };
  }

  /**
   * 共通ミドルウェアを追加
   */
  private addCommonMiddleware(): void {
    // 保存前のミドルウェア
    this.schema.pre('save', function(next) {
      // timestampを更新
      if (!this.timestamp) {
        this.timestamp = new Date();
      }
      
      // 文字列フィールドのtrim処理
      this.schema.eachPath((pathname, schematype) => {
        if (schematype instanceof mongoose.Schema.Types.String) {
          const value = this.get(pathname);
          if (typeof value === 'string') {
            this.set(pathname, value.trim());
          }
        }
      });
      
      next();
    });

    // 更新前のミドルウェア
    this.schema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function(next) {
      // updatedAtを自動更新
      this.set({ updatedAt: new Date() });
      next();
    });

    // 削除前のミドルウェア（ログ出力）
    this.schema.pre('findOneAndDelete', function(next) {
      console.log(`Deleting ${this.getQuery()._id} from ${this.model.collection.name}`);
      next();
    });
  }

  /**
   * 共通インデックスを追加
   */
  private addCommonIndexes(): void {
    // 基本的なインデックス
    this.schema.index({ timestamp: -1 }); // 時系列検索用
    this.schema.index({ createdAt: -1 }); // 作成日時検索用
    this.schema.index({ updatedAt: -1 }); // 更新日時検索用
  }

  /**
   * カスタムインデックスを追加するためのメソッド
   */
  protected addCustomIndex(indexSpec: Record<string, any>, options?: mongoose.IndexOptions): void {
    this.schema.index(indexSpec, options);
  }

  /**
   * カスタムメソッドを追加するためのメソッド
   */
  protected addCustomMethod(name: string, method: Function): void {
    this.schema.methods[name] = method;
  }

  /**
   * カスタムスタティックメソッドを追加するためのメソッド
   */
  protected addCustomStatic(name: string, method: (...args: any[]) => any): void {
    this.schema.statics[name] = method;
  }

  /**
   * カスタムミドルウェアを追加するためのメソッド
   */
  protected addCustomMiddleware(
    operation: 'save' | 'validate' | 'remove' | 'findOneAndUpdate' | 'updateOne' | 'updateMany',
    middleware: (this: T, next: mongoose.CallbackWithoutResult) => void
  ): void {
    this.schema.pre(operation as any, middleware);
  }

  /**
   * モデルを取得
   */
  getModel(): Model<T> {
    return this.model;
  }

  /**
   * スキーマを取得
   */
  getSchema(): Schema<T> {
    return this.schema;
  }

  /**
   * モデル名を取得
   */
  getModelName(): string {
    return this.modelName;
  }

  /**
   * コレクション名を取得
   */
  getCollectionName(): string {
    return this.collectionName;
  }
}

/**
 * BaseModelファクトリー関数
 * 簡単にBaseModelを継承したモデルを作成するためのヘルパー
 */
export function createBaseModel<T extends BaseDocument>(
  modelName: string,
  schemaDefinition: Record<string, any>,
  collectionName?: string,
  additionalOptions?: SchemaOptions
): Model<T> {
  class ConcreteBaseModel extends BaseModel<T> {
    constructor() {
      super(modelName, schemaDefinition, collectionName, additionalOptions);
    }
  }
  
  const instance = new ConcreteBaseModel();
  return instance.getModel();
}

export default BaseModel;
