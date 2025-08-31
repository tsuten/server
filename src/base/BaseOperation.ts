import { Model, Document } from 'mongoose';
import { BaseOperationInterface } from '../types/operation.js';
import { BaseEntity, ValidationResult, OperationResult, QueryOptions } from '../types/base.js';
import { SchemaInterface } from '../types/schema.js';
import { createLogger, LogCategory } from '../utils/consoleLog.js';

/**
 * 抽象基盤Operationクラス
 * 全てのエンティティ操作で共通するCRUD操作を実装
 */
export abstract class BaseOperation<
  T extends BaseEntity,
  CreateData,
  UpdateData
> implements BaseOperationInterface<T, CreateData, UpdateData> {
  
  protected model: Model<any>;
  protected schema: SchemaInterface<CreateData>;
  protected logger = createLogger(LogCategory.OPERATION, 'BaseOperation');

  constructor(model: Model<any>, schema: SchemaInterface<CreateData>) {
    this.model = model;
    this.schema = schema;
  }

  /**
   * エンティティを作成
   */
  async create(data: CreateData): Promise<OperationResult<T>> {
    try {
      this.logger.debug('create called', data);
      
      // バリデーション
      this.logger.debug('Starting validation');
      const validation = this.validate(data);
      this.logger.debug('Validation result', validation);
      
      if (!validation.isValid) {
        this.logger.warn('Validation failed', { errors: validation.errors });
        return {
          success: false,
          errors: validation.errors
        };
      }

      this.logger.debug('Creating new entity with model');
      
      // データベースに保存
      const newEntity = new this.model(validation.data as any);
      this.logger.debug('New entity created, saving');
      
      const savedEntity = await newEntity.save();
      this.logger.info('Entity saved successfully', { entityId: savedEntity._id });
      
      return {
        success: true,
        data: savedEntity.toObject() as T
      };
    } catch (error) {
      this.logger.error('Error creating entity', error, data);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * IDでエンティティを検索
   */
  async findById(id: string): Promise<OperationResult<T>> {
    try {
      if (!this.isValidObjectId(id)) {
        return {
          success: false,
          error: 'Invalid ID format'
        };
      }

      const entity = await this.model.findById(id).lean();
      
      if (!entity) {
        return {
          success: false,
          error: 'Entity not found'
        };
      }
      
      return {
        success: true,
        data: entity as T
      };
    } catch (error) {
      console.error('Error finding entity by ID:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * エンティティを更新
   */
  async update(id: string, data: UpdateData): Promise<OperationResult<T>> {
    try {
      if (!this.isValidObjectId(id)) {
        return {
          success: false,
          error: 'Invalid ID format'
        };
      }

      // 部分的なバリデーション（更新データ用）
      const sanitizedData = this.sanitizeUpdateData(data);
      
      const updatedEntity = await this.model.findByIdAndUpdate(
        id,
        { 
          ...sanitizedData,
          updatedAt: new Date()
        },
        { 
          new: true, 
          runValidators: true,
          lean: true
        }
      );

      if (!updatedEntity) {
        return {
          success: false,
          error: 'Entity not found'
        };
      }

      console.log(`Entity updated: ${id}`);
      return {
        success: true,
        data: updatedEntity as T
      };
    } catch (error) {
      console.error('Error updating entity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * エンティティを削除
   */
  async delete(id: string): Promise<OperationResult<T>> {
    try {
      if (!this.isValidObjectId(id)) {
        return {
          success: false,
          error: 'Invalid ID format'
        };
      }

      const deletedEntity = await this.model.findByIdAndDelete(id).lean();

      if (!deletedEntity) {
        return {
          success: false,
          error: 'Entity not found'
        };
      }

      console.log(`Entity deleted: ${id}`);
      return {
        success: true,
        data: deletedEntity as T
      };
    } catch (error) {
      console.error('Error deleting entity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * 複数のエンティティを検索
   */
  async findMany(query: Partial<T> = {}, options: QueryOptions = {}): Promise<OperationResult<T[]>> {
    try {
      const {
        limit = 50,
        skip = 0,
        sort = { timestamp: -1 },
        lean = true
      } = options;

      // クエリの構築
      const sanitizedQuery = this.sanitizeQuery(query);
      
      let queryBuilder = this.model.find(sanitizedQuery);
      
      if (lean) {
        queryBuilder = queryBuilder.lean();
      }
      
      const entities = await queryBuilder
        .sort(sort)
        .limit(Math.min(limit, 1000)) // 最大1000件まで
        .skip(skip);

      return {
        success: true,
        data: entities as T[]
      };
    } catch (error) {
      console.error('Error finding entities:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * エンティティ数をカウント
   */
  async count(query: Partial<T> = {}): Promise<OperationResult<number>> {
    try {
      const sanitizedQuery = this.sanitizeQuery(query);
      const count = await this.model.countDocuments(sanitizedQuery);
      
      return {
        success: true,
        data: count
      };
    } catch (error) {
      console.error('Error counting entities:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * データをバリデーション
   */
  validate(data: unknown): ValidationResult<CreateData> {
    return this.schema.validate(data);
  }

  /**
   * 更新データのサニタイズ（オーバーライド可能）
   */
  protected sanitizeUpdateData(data: UpdateData): Partial<UpdateData> {
    // 基本実装：不正なフィールドを除去
    const sanitized: Partial<UpdateData> = {};
    
    if (data && typeof data === 'object') {
      // UpdateData の型安全性を保ちつつコピー
      Object.keys(data).forEach(key => {
        const value = (data as any)[key];
        if (value !== undefined && value !== null) {
          (sanitized as any)[key] = typeof value === 'string' ? value.trim() : value;
        }
      });
    }
    
    return sanitized;
  }

  /**
   * クエリのサニタイズ
   */
  protected sanitizeQuery(query: Partial<T>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    Object.keys(query).forEach(key => {
      const value = (query as any)[key];
      if (value !== undefined && value !== null) {
        sanitized[key] = typeof value === 'string' ? value.trim() : value;
      }
    });
    
    return sanitized;
  }

  /**
   * ObjectIdの有効性チェック
   */
  protected isValidObjectId(id: string): boolean {
    // MongoDBのObjectIdの形式をチェック（24文字の16進数）
    return /^[0-9a-fA-F]{24}$/.test(id);
  }

  /**
   * エラーレスポンスの生成
   */
  protected createErrorResult(message: string): OperationResult<any> {
    return {
      success: false,
      error: message
    };
  }

  /**
   * 成功レスポンスの生成
   */
  protected createSuccessResult<R>(data: R): OperationResult<R> {
    return {
      success: true,
      data
    };
  }
}
