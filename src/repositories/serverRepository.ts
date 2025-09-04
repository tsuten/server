import { ServerModel } from '../models/ServerModel.js';
import { ServerEntity, ServerCreateData, ServerSettings } from '../types/server.js';
import { OperationResult, QueryOptions, ValidationError } from '../types/base.js';

/**
 * ServerRepository クラス
 * サーバー（全体設定）データアクセス層。サーバーは単一インスタンス（最大1件）のみ許可。
 */
export class ServerRepository {
  private model = ServerModel;

  /**
   * サーバーを作成（シングルトン制約）
   */
  async create(data: ServerCreateData): Promise<OperationResult<ServerEntity>> {
    try {
      // 既存サーバーの存在チェック（最大1件）
      const existingCount = await this.model.countDocuments({}).exec();
      if (existingCount > 0) {
        return this.createErrorResult('Server already exists (only one server is allowed)');
      }

      // バリデーション
      const validation = this.validate(data);
      if (!validation.isValid) {
        return this.createErrorResult('Validation failed', validation.errors);
      }

      const server = new this.model(validation.data!);
      const saved = await server.save();

      return this.createSuccessResult(saved.toJSON() as ServerEntity);
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 単一サーバーを取得（存在しない場合はエラー）
   */
  async get(): Promise<OperationResult<ServerEntity>> {
    try {
      const server = await this.model.findOne({}).lean().exec();
      if (!server) {
        return this.createErrorResult('Server not found');
      }
      return this.createSuccessResult(server as ServerEntity);
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * IDで取得
   */
  async findById(id: string): Promise<OperationResult<ServerEntity>> {
    try {
      if (!id) return this.createErrorResult('Server ID is required');
      const server = await this.model.findById(id).lean().exec();
      if (!server) return this.createErrorResult('Server not found');
      return this.createSuccessResult(server as ServerEntity);
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * サーバーを更新（単一インスタンス前提）
   */
  async update(partial: Partial<ServerCreateData>): Promise<OperationResult<ServerEntity>> {
    try {
      // 入力の基本バリデーション（提供されたフィールドのみチェック）
      const validation = this.validatePartial(partial);
      if (!validation.isValid) {
        return this.createErrorResult('Validation failed', validation.errors);
      }

      const updated = await this.model.findOneAndUpdate(
        {},
        { $set: { ...validation.data, updatedAt: new Date() } },
        { new: true, runValidators: true }
      ).lean().exec();

      if (!updated) {
        return this.createErrorResult('Server not found');
      }

      return this.createSuccessResult(updated as ServerEntity);
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * サーバーを削除（開発/リセット用途）
   */
  async delete(): Promise<OperationResult<ServerEntity>> {
    try {
      const deleted = await this.model.findOneAndDelete({}).lean().exec();
      if (!deleted) {
        return this.createErrorResult('Server not found');
      }
      return this.createSuccessResult(deleted as ServerEntity);
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 件数（0 または 1）
   */
  async count(): Promise<OperationResult<number>> {
    try {
      const count = await this.model.countDocuments({}).exec();
      return this.createSuccessResult(count);
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * バリデーション（作成用）
   */
  validate(data: unknown): { isValid: boolean; errors: ValidationError[]; data: ServerCreateData | null } {
    const errors: ValidationError[] = [];
    try {
      const input = data as ServerCreateData;

      if (!input || typeof input !== 'object') {
        return { isValid: false, errors: [{ field: 'data', message: 'Invalid data format' }], data: null };
      }

      // name
      if (!input.name || typeof input.name !== 'string' || input.name.trim().length < 1) {
        errors.push({ field: 'name', message: 'name is required' });
      } else if (input.name.trim().length > 100) {
        errors.push({ field: 'name', message: 'name must be at most 100 characters' });
      }

      // description
      if (!input.description || typeof input.description !== 'string') {
        errors.push({ field: 'description', message: 'description is required' });
      } else if (input.description.trim().length > 500) {
        errors.push({ field: 'description', message: 'description must be at most 500 characters' });
      }

      // slug
      if (input.logo !== undefined && typeof input.logo !== 'string') {
        errors.push({ field: 'logo', message: 'logo must be a string' });
      }

      if (input.language !== undefined) {
        if (typeof input.language !== 'string') {
          errors.push({ field: 'language', message: 'language must be a string' });
        } else if (input.language.trim().length > 10) {
          errors.push({ field: 'language', message: 'language must be at most 10 characters' });
        }
      }


      if (input.categories !== undefined) {
        if (!Array.isArray(input.categories)) {
          errors.push({ field: 'categories', message: 'categories must be an array of strings' });
        } else if (input.categories.some(c => typeof c !== 'string' || c.trim().length > 50)) {
          errors.push({ field: 'categories', message: 'each category must be a string with max 50 chars' });
        }
      }

      const sanitized: ServerCreateData = {
        name: input.name?.trim(),
        description: input.description?.trim(),
        logo: input.logo?.trim(),
        language: input.language?.trim(),
        categories: input.categories?.map(c => c.trim())
      };

      return { isValid: errors.length === 0, errors, data: errors.length === 0 ? sanitized : null };
    } catch (e) {
      return { isValid: false, errors: [{ field: 'data', message: 'Invalid data format' }], data: null };
    }
  }

  /**
   * バリデーション（更新用、与えられたフィールドのみ）
   */
  validatePartial(partial: Partial<ServerCreateData>): { isValid: boolean; errors: ValidationError[]; data: Partial<ServerCreateData> | null } {
    const errors: ValidationError[] = [];
    const data: Partial<ServerCreateData> = {};

    if (partial.name !== undefined) {
      if (typeof partial.name !== 'string' || partial.name.trim().length < 1) {
        errors.push({ field: 'name', message: 'name must be a non-empty string' });
      } else if (partial.name.trim().length > 100) {
        errors.push({ field: 'name', message: 'name must be at most 100 characters' });
      } else {
        data.name = partial.name.trim();
      }
    }

    if (partial.description !== undefined) {
      if (typeof partial.description !== 'string') {
        errors.push({ field: 'description', message: 'description must be a string' });
      } else if (partial.description.trim().length > 500) {
        errors.push({ field: 'description', message: 'description must be at most 500 characters' });
      } else {
        data.description = partial.description.trim();
      }
    }

    if (partial.logo !== undefined) {
      if (typeof partial.logo !== 'string') {
        errors.push({ field: 'logo', message: 'logo must be a string' });
      } else {
        data.logo = partial.logo.trim();
      }
    }

    if (partial.language !== undefined) {
      if (typeof partial.language !== 'string') {
        errors.push({ field: 'language', message: 'language must be a string' });
      } else if (partial.language.trim().length > 10) {
        errors.push({ field: 'language', message: 'language must be at most 10 characters' });
      } else {
        data.language = partial.language.trim();
      }
    }


    if (partial.categories !== undefined) {
      if (!Array.isArray(partial.categories)) {
        errors.push({ field: 'categories', message: 'categories must be an array of strings' });
      } else if (partial.categories.some(c => typeof c !== 'string' || c.trim().length > 50)) {
        errors.push({ field: 'categories', message: 'each category must be a string with max 50 chars' });
      } else {
        data.categories = partial.categories.map(c => c.trim());
      }
    }

    if (partial.settings !== undefined) {
      if (typeof partial.settings !== 'object' || partial.settings === null) {
        errors.push({ field: 'settings', message: 'settings must be an object' });
      } else {
        const settings: Partial<ServerSettings> = {};
        
        if (partial.settings.is_private !== undefined) {
          if (typeof partial.settings.is_private !== 'boolean') {
            errors.push({ field: 'settings.is_private', message: 'is_private must be a boolean' });
          } else {
            settings.is_private = partial.settings.is_private;
          }
        }
        
        if (partial.settings.max_members !== undefined) {
          if (typeof partial.settings.max_members !== 'number' || isNaN(partial.settings.max_members)) {
            errors.push({ field: 'settings.max_members', message: 'max_members must be a number' });
          } else if (partial.settings.max_members < 1) {
            errors.push({ field: 'settings.max_members', message: 'max_members must be at least 1' });
          } else if (partial.settings.max_members > 100000) {
            errors.push({ field: 'settings.max_members', message: 'max_members must be at most 100000' });
          } else {
            settings.max_members = partial.settings.max_members;
          }
        }
        
        if (Object.keys(settings).length > 0) {
          data.settings = settings as ServerSettings;
        }
      }
    }

    return { isValid: errors.length === 0, errors, data: errors.length === 0 ? data : null };
  }

  /**
   * 成功結果を作成するヘルパーメソッド
   */
  private createSuccessResult<T>(data: T): OperationResult<T> {
    return { success: true, data };
  }

  /**
   * エラー結果を作成するヘルパーメソッド
   */
  private createErrorResult(error: string, errors?: ValidationError[]): OperationResult<any> {
    return { success: false, error, errors };
  }
}

// シングルトンインスタンス
export const serverRepository = new ServerRepository();

export default serverRepository;


