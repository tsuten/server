import { UserModel, UserDocument } from '../models/UserModel.js';
import {
  UserEntity,
  UserCreateData,
  UserUpdateData,
  UserOperationInterface,
  UserType,
  UserSettings
} from '../types/user.js';
import { OperationResult, ValidationResult, ValidationError, QueryOptions } from '../types/base.js';
import { userSchema } from '../schemas/UserSchema.js';

/**
 * UserRepository クラス
 * ユーザー関連のデータベース操作を担当するRepository層
 */
export class UserRepository implements UserOperationInterface {

  /**
   * ユーザーを作成
   */
  async create(data: UserCreateData): Promise<OperationResult<UserEntity>> {
    try {
      // バリデーション
      const validation = this.validate(data);
      if (!validation.isValid) {
        return this.createErrorResult('Validation failed', validation.errors);
      }

      // authIdの重複チェック
      const existingUser = await this.findByAuthId(data.authId);
      if (existingUser.success) {
        return this.createErrorResult('User with this authId already exists');
      }

      // メールアドレスの重複チェック（メールアドレスが提供されている場合）
      if (data.email) {
        const existingEmail = await this.findByEmail(data.email);
        if (existingEmail.success && existingEmail.data && existingEmail.data.length > 0) {
          return this.createErrorResult('User with this email already exists');
        }
      }

      const userData = {
        ...data,
        type: data.type || 'user', // デフォルトは'user'
        isOnline: false,
        lastSeen: new Date()
      };

      const user = new UserModel(userData);
      const savedUser = await user.save();
      
      return this.createSuccessResult(savedUser.toJSON());
    } catch (error) {
      console.error('Error creating user:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * IDでユーザーを取得
   */
  async findById(id: string): Promise<OperationResult<UserEntity>> {
    try {
      if (!id) {
        return this.createErrorResult('User ID is required');
      }

      const user = await UserModel.findById(id).lean();
      
      if (!user) {
        return this.createErrorResult('User not found');
      }

      return this.createSuccessResult(user as UserEntity);
    } catch (error) {
      console.error('Error finding user by ID:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 認証IDでユーザーを取得
   */
  async findByAuthId(authId: string): Promise<OperationResult<UserEntity>> {
    try {
      if (!authId || typeof authId !== 'string') {
        return this.createErrorResult('AuthId is required and must be a string');
      }

      const user = await UserModel.findOne({ authId: authId.trim() }).lean();
      
      if (!user) {
        return this.createErrorResult('User not found');
      }

      return this.createSuccessResult(user as UserEntity);
    } catch (error) {
      console.error('Error finding user by authId:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * メールアドレスでユーザーを検索
   */
  async findByEmail(email: string, options?: QueryOptions): Promise<OperationResult<UserEntity[]>> {
    try {
      if (!email || typeof email !== 'string') {
        return this.createErrorResult('Email is required and must be a string');
      }

      const {
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 },
        lean = true
      } = options || {};

      let queryBuilder: any = UserModel.find({ email: email.trim().toLowerCase() });
      
      if (lean) {
        queryBuilder = queryBuilder.lean();
      }
      
      const users = await (queryBuilder as any)
        .sort(sort)
        .limit(Math.min(limit, 1000))
        .skip(skip);

      return this.createSuccessResult(users as UserEntity[]);
    } catch (error) {
      console.error('Error finding users by email:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザータイプでユーザーを検索
   */
  async findByType(type: UserType, options?: QueryOptions): Promise<OperationResult<UserEntity[]>> {
    try {
      if (!type) {
        return this.createErrorResult('User type is required');
      }

      const {
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 },
        lean = true
      } = options || {};

      let queryBuilder: any = UserModel.find({ type });
      
      if (lean) {
        queryBuilder = queryBuilder.lean();
      }
      
      const users = await (queryBuilder as any)
        .sort(sort)
        .limit(Math.min(limit, 1000))
        .skip(skip);

      return this.createSuccessResult(users as UserEntity[]);
    } catch (error) {
      console.error('Error finding users by type:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * オンラインユーザーを検索
   */
  async findOnlineUsers(options?: QueryOptions): Promise<OperationResult<UserEntity[]>> {
    try {
      const {
        limit = 50,
        skip = 0,
        sort = { lastSeen: -1 },
        lean = true
      } = options || {};

      let queryBuilder: any = UserModel.find({ isOnline: true });
      
      if (lean) {
        queryBuilder = queryBuilder.lean();
      }
      
      const users = await (queryBuilder as any)
        .sort(sort)
        .limit(Math.min(limit, 1000))
        .skip(skip);

      return this.createSuccessResult(users as UserEntity[]);
    } catch (error) {
      console.error('Error finding online users:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザーを検索
   */
  async searchUsers(keyword: string, options?: QueryOptions): Promise<OperationResult<UserEntity[]>> {
    try {
      if (!keyword || typeof keyword !== 'string') {
        return this.createErrorResult('Search keyword is required and must be a string');
      }

      const {
        limit = 50,
        skip = 0,
        sort = { displayName: 1 },
        lean = true
      } = options || {};

      const searchRegex = new RegExp(keyword.trim(), 'i');
      const query = {
        $or: [
          { displayName: searchRegex },
          { email: searchRegex }
        ]
      };

      let queryBuilder: any = UserModel.find(query);
      
      if (lean) {
        queryBuilder = queryBuilder.lean();
      }
      
      const users = await (queryBuilder as any)
        .sort(sort)
        .limit(Math.min(limit, 1000))
        .skip(skip);

      return this.createSuccessResult(users as UserEntity[]);
    } catch (error) {
      console.error('Error searching users:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザーを更新
   */
  async update(id: string, data: UserUpdateData): Promise<OperationResult<UserEntity>> {
    try {
      if (!id) {
        return this.createErrorResult('User ID is required');
      }

      // メールアドレスの重複チェック（自分以外のユーザーで同じメールアドレスがないか）
      if (data.email) {
        const existingEmail = await this.findByEmail(data.email);
        if (existingEmail.success && existingEmail.data && existingEmail.data.length > 0) {
          const otherUser = existingEmail.data.find(user => user._id !== id);
          if (otherUser) {
            return this.createErrorResult('User with this email already exists');
          }
        }
      }

      const updatedUser = await UserModel.findByIdAndUpdate(
        id,
        { 
          $set: {
            ...data,
            updatedAt: new Date()
          }
        },
        { new: true, runValidators: true }
      ).lean();

      if (!updatedUser) {
        return this.createErrorResult('User not found');
      }

      return this.createSuccessResult(updatedUser as UserEntity);
    } catch (error) {
      console.error('Error updating user:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザーを削除
   */
  async delete(id: string): Promise<OperationResult<UserEntity>> {
    try {
      if (!id) {
        return this.createErrorResult('User ID is required');
      }

      const deletedUser = await UserModel.findByIdAndDelete(id).lean();

      if (!deletedUser) {
        return this.createErrorResult('User not found');
      }

      return this.createSuccessResult(deletedUser as UserEntity);
    } catch (error) {
      console.error('Error deleting user:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 複数のユーザーを検索
   */
  async findMany(query: Partial<UserEntity> = {}, options: QueryOptions = {}): Promise<OperationResult<UserEntity[]>> {
    try {
      const {
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 },
        lean = true
      } = options;

      // クエリのサニタイズ
      const sanitizedQuery = this.sanitizeQuery(query);
      
      let queryBuilder: any = UserModel.find(sanitizedQuery);
      
      if (lean) {
        queryBuilder = queryBuilder.lean();
      }
      
      const users = await (queryBuilder as any)
        .sort(sort)
        .limit(Math.min(limit, 1000))
        .skip(skip);

      return this.createSuccessResult(users as UserEntity[]);
    } catch (error) {
      console.error('Error finding users:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザー数をカウント
   */
  async count(query: Partial<UserEntity> = {}): Promise<OperationResult<number>> {
    try {
      const sanitizedQuery = this.sanitizeQuery(query);
      const count = await UserModel.countDocuments(sanitizedQuery);
      
      return this.createSuccessResult(count);
    } catch (error) {
      console.error('Error counting users:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * オンライン状態を更新
   */
  async updateOnlineStatus(userId: string, isOnline: boolean): Promise<OperationResult<UserEntity>> {
    try {
      if (!userId) {
        return this.createErrorResult('User ID is required');
      }

      const updateData: UserUpdateData = {
        isOnline,
        lastSeen: new Date()
      };

      return await this.update(userId, updateData);
    } catch (error) {
      console.error('Error updating online status:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 最終アクセス時刻を更新
   */
  async updateLastSeen(userId: string): Promise<OperationResult<UserEntity>> {
    try {
      if (!userId) {
        return this.createErrorResult('User ID is required');
      }

      const updateData: UserUpdateData = {
        lastSeen: new Date()
      };

      return await this.update(userId, updateData);
    } catch (error) {
      console.error('Error updating last seen:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザータイプを更新
   */
  async updateUserType(userId: string, type: UserType): Promise<OperationResult<UserEntity>> {
    try {
      if (!userId) {
        return this.createErrorResult('User ID is required');
      }

      if (!type) {
        return this.createErrorResult('User type is required');
      }

      const updateData: UserUpdateData = { type };
      return await this.update(userId, updateData);
    } catch (error) {
      console.error('Error updating user type:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザー設定を更新
   */
  async updateUserSettings(userId: string, settings: UserSettings): Promise<OperationResult<UserEntity>> {
    try {
      if (!userId) {
        return this.createErrorResult('User ID is required');
      }

      if (!settings || typeof settings !== 'object') {
        return this.createErrorResult('Settings must be a valid object');
      }

      const updateData: UserUpdateData = { settings };
      return await this.update(userId, updateData);
    } catch (error) {
      console.error('Error updating user settings:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * タイプ別ユーザー数を取得
   */
  async getUserCountByType(type?: UserType): Promise<OperationResult<number>> {
    try {
      const query = type ? { type } : {};
      return await this.count(query);
    } catch (error) {
      console.error('Error getting user count by type:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * オンラインユーザー数を取得
   */
  async getOnlineUserCount(): Promise<OperationResult<number>> {
    try {
      return await this.count({ isOnline: true });
    } catch (error) {
      console.error('Error getting online user count:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
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
      const totalUsersResult = await this.count();
      if (!totalUsersResult.success) {
        return this.createErrorResult('Failed to get total user count');
      }

      const onlineUsersResult = await this.getOnlineUserCount();
      if (!onlineUsersResult.success) {
        return this.createErrorResult('Failed to get online user count');
      }

      // タイプ別ユーザー数を取得
      const userTypes: UserType[] = ['admin', 'moderator', 'user', 'guest'];
      const usersByType: Record<UserType, number> = {} as Record<UserType, number>;

      for (const type of userTypes) {
        const countResult = await this.getUserCountByType(type);
        usersByType[type] = countResult.success ? countResult.data! : 0;
      }

      return this.createSuccessResult({
        totalUsers: totalUsersResult.data!,
        onlineUsers: onlineUsersResult.data!,
        usersByType
      });
    } catch (error) {
      console.error('Error getting user statistics:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザータイプの一覧を取得
   */
  getUserTypes(): UserType[] {
    return ['admin', 'moderator', 'user', 'guest'];
  }

  /**
   * 基本バリデーション
   */
  validate(data: unknown): ValidationResult<UserCreateData> {
    return userSchema.validate(data);
  }

  /**
   * クエリのサニタイズ
   */
  private sanitizeQuery(query: Partial<UserEntity>): Record<string, any> {
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
   * 成功結果を作成するヘルパーメソッド
   */
  private createSuccessResult<T>(data: T): OperationResult<T> {
    return {
      success: true,
      data
    };
  }

  /**
   * エラー結果を作成するヘルパーメソッド
   */
  private createErrorResult(error: string, errors?: ValidationError[]): OperationResult<any> {
    return {
      success: false,
      error,
      errors
    };
  }
}

// シングルトンインスタンス
export const userRepository = new UserRepository();

export default userRepository;
