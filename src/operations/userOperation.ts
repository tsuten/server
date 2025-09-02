import { BaseOperation } from '../base/BaseOperation.js';
import { UserModel } from '../models/UserModel.js';
import { userSchema } from '../schemas/UserSchema.js';
import { userRepository } from '../repositories/userRepository.js';
import { createLogger, LogCategory } from '../utils/consoleLog.js';
import {
  UserEntity,
  UserCreateData,
  UserUpdateData,
  UserOperationInterface,
  UserType,
  UserSettings
} from '../types/user.js';
import { OperationResult, ValidationResult, QueryOptions } from '../types/base.js';

/**
 * ユーザー操作クラス
 * BaseOperationを継承し、ユーザー固有の操作を実装
 */
export class UserOperation 
  extends BaseOperation<UserEntity, UserCreateData, UserUpdateData>
  implements UserOperationInterface {

  protected logger = createLogger(LogCategory.OPERATION, 'UserOperation');

  constructor() {
    super(UserModel as any, userSchema as any);
  }

  /**
   * メールアドレスでユーザーを検索
   */
  async findByEmail(email: string, options?: QueryOptions): Promise<OperationResult<UserEntity[]>> {
    try {
      this.logger.debug('findByEmail called', { email });
      
      if (!email || typeof email !== 'string') {
        return this.createErrorResult('メールアドレスは必須で、文字列である必要があります');
      }

      const result = await userRepository.findByEmail(email.trim(), options);
      return result;
    } catch (error) {
      this.logger.error('Error finding users by email', error, { email });
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 認証IDでユーザーを取得
   */
  async findByAuthId(authId: string): Promise<OperationResult<UserEntity>> {
    try {
      this.logger.debug('findByAuthId called', { authId });
      
      if (!authId || typeof authId !== 'string') {
        return this.createErrorResult('認証IDは必須で、文字列である必要があります');
      }

      const result = await userRepository.findByAuthId(authId.trim());
      return result;
    } catch (error) {
      this.logger.error('Error finding user by authId', error, { authId });
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザータイプでユーザーを検索
   */
  async findByType(type: UserType, options?: QueryOptions): Promise<OperationResult<UserEntity[]>> {
    try {
      this.logger.debug('findByType called', { type });
      
      if (!type) {
        return this.createErrorResult('ユーザータイプは必須です');
      }

      const validTypes = this.getUserTypes();
      if (!validTypes.includes(type)) {
        return this.createErrorResult('無効なユーザータイプです');
      }

      const result = await userRepository.findByType(type, options);
      return result;
    } catch (error) {
      this.logger.error('Error finding users by type', error, { type });
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * オンラインユーザーを検索
   */
  async findOnlineUsers(options?: QueryOptions): Promise<OperationResult<UserEntity[]>> {
    try {
      this.logger.debug('findOnlineUsers called');
      
      const result = await userRepository.findOnlineUsers(options);
      return result;
    } catch (error) {
      this.logger.error('Error finding online users', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザーを検索
   */
  async searchUsers(keyword: string, options?: QueryOptions): Promise<OperationResult<UserEntity[]>> {
    try {
      this.logger.debug('searchUsers called', { keyword });
      
      if (!keyword || typeof keyword !== 'string') {
        return this.createErrorResult('検索キーワードは必須で、文字列である必要があります');
      }

      if (keyword.trim().length < 2) {
        return this.createErrorResult('検索キーワードは2文字以上である必要があります');
      }

      const result = await userRepository.searchUsers(keyword.trim(), options);
      return result;
    } catch (error) {
      this.logger.error('Error searching users', error, { keyword });
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * オンライン状態を更新
   */
  async updateOnlineStatus(userId: string, isOnline: boolean): Promise<OperationResult<UserEntity>> {
    try {
      this.logger.debug('updateOnlineStatus called', { userId, isOnline });
      
      if (!userId) {
        return this.createErrorResult('ユーザーIDは必須です');
      }

      if (typeof isOnline !== 'boolean') {
        return this.createErrorResult('オンライン状態は真偽値である必要があります');
      }

      const result = await userRepository.updateOnlineStatus(userId, isOnline);
      
      if (result.success && result.data) {
        this.logger.info('User online status updated', {
          userId,
          isOnline,
          displayName: result.data.displayName
        });
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error updating online status', error, { userId, isOnline });
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 最終アクセス時刻を更新
   */
  async updateLastSeen(userId: string): Promise<OperationResult<UserEntity>> {
    try {
      this.logger.debug('updateLastSeen called', { userId });
      
      if (!userId) {
        return this.createErrorResult('ユーザーIDは必須です');
      }

      const result = await userRepository.updateLastSeen(userId);
      
      if (result.success && result.data) {
        this.logger.debug('User last seen updated', {
          userId,
          displayName: result.data.displayName
        });
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error updating last seen', error, { userId });
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザータイプを更新
   */
  async updateUserType(userId: string, type: UserType): Promise<OperationResult<UserEntity>> {
    try {
      this.logger.debug('updateUserType called', { userId, type });
      
      if (!userId) {
        return this.createErrorResult('ユーザーIDは必須です');
      }

      if (!type) {
        return this.createErrorResult('ユーザータイプは必須です');
      }

      const validTypes = this.getUserTypes();
      if (!validTypes.includes(type)) {
        return this.createErrorResult('無効なユーザータイプです');
      }

      const result = await userRepository.updateUserType(userId, type);
      
      if (result.success && result.data) {
        this.logger.info('User type updated', {
          userId,
          type,
          displayName: result.data.displayName
        });
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error updating user type', error, { userId, type });
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザー設定を更新
   */
  async updateUserSettings(userId: string, settings: UserSettings): Promise<OperationResult<UserEntity>> {
    try {
      this.logger.debug('updateUserSettings called', { userId, settings });
      
      if (!userId) {
        return this.createErrorResult('ユーザーIDは必須です');
      }

      if (!settings || typeof settings !== 'object') {
        return this.createErrorResult('設定は有効なオブジェクトである必要があります');
      }

      const result = await userRepository.updateUserSettings(userId, settings);
      
      if (result.success && result.data) {
        this.logger.info('User settings updated', {
          userId,
          displayName: result.data.displayName
        });
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error updating user settings', error, { userId, settings });
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * タイプ別ユーザー数を取得
   */
  async getUserCountByType(type?: UserType): Promise<OperationResult<number>> {
    try {
      this.logger.debug('getUserCountByType called', { type });
      
      if (type) {
        const validTypes = this.getUserTypes();
        if (!validTypes.includes(type)) {
          return this.createErrorResult('無効なユーザータイプです');
        }
      }

      const result = await userRepository.getUserCountByType(type);
      return result;
    } catch (error) {
      this.logger.error('Error getting user count by type', error, { type });
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * オンラインユーザー数を取得
   */
  async getOnlineUserCount(): Promise<OperationResult<number>> {
    try {
      this.logger.debug('getOnlineUserCount called');
      
      const result = await userRepository.getOnlineUserCount();
      return result;
    } catch (error) {
      this.logger.error('Error getting online user count', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザータイプの一覧を取得
   */
  getUserTypes(): UserType[] {
    return userRepository.getUserTypes();
  }

  /**
   * ユーザー統計を取得
   */
  async getUserStatistics(): Promise<OperationResult<{
    totalUsers: number;
    onlineUsers: number;
    usersByType: Record<UserType, number>;
  }>> {
    try {
      this.logger.debug('getUserStatistics called');
      
      const result = await userRepository.getUserStatistics();
      return result;
    } catch (error) {
      this.logger.error('Error getting user statistics', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザー作成（オーバーライド）
   * 追加のビジネスロジックを含む
   */
  async create(data: UserCreateData): Promise<OperationResult<UserEntity>> {
    try {
      this.logger.debug('create called', { authId: data.authId, displayName: data.displayName });
      
      // 認証IDの重複チェック
      const existingUser = await this.findByAuthId(data.authId);
      if (existingUser.success) {
        this.logger.warn('User with authId already exists', { authId: data.authId });
        return this.createErrorResult('この認証IDのユーザーは既に存在します');
      }

      // Repository層での作成処理
      const result = await userRepository.create(data);
      
      if (result.success && result.data) {
        this.logger.info('User created successfully', {
          authId: data.authId,
          displayName: data.displayName,
          userId: result.data._id
        });
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error creating user', error, { authId: data.authId, displayName: data.displayName });
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザー更新（オーバーライド）
   * 追加のビジネスロジックを含む
   */
  async update(id: string, data: UserUpdateData): Promise<OperationResult<UserEntity>> {
    try {
      this.logger.debug('update called', { userId: id });
      
      if (!id) {
        return this.createErrorResult('ユーザーIDは必須です');
      }

      // Repository層での更新処理
      const result = await userRepository.update(id, data);
      
      if (result.success && result.data) {
        this.logger.info('User updated successfully', {
          userId: id,
          displayName: result.data.displayName
        });
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error updating user', error, { userId: id });
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 更新データのサニタイズ（オーバーライド）
   */
  protected sanitizeUpdateData(data: UserUpdateData): Partial<UserUpdateData> {
    const sanitized = super.sanitizeUpdateData(data);
    
    // メールアドレスの正規化
    if (sanitized.email !== undefined) {
      sanitized.email = sanitized.email?.toLowerCase().trim();
    }
    
    // 表示名の正規化
    if (sanitized.displayName !== undefined) {
      sanitized.displayName = sanitized.displayName?.trim();
    }
    
    return sanitized;
  }
}

// シングルトンインスタンス
export const userOperation = new UserOperation();

export default userOperation;
