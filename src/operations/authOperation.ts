import { BaseOperation } from '../base/BaseOperation.js';
import { AuthModel } from '../models/AuthModel.js';
import { authSchema } from '../schemas/AuthSchema.js';
import { authRepository } from '../repositories/authRepository.js';
import { createLogger, LogCategory } from '../utils/consoleLog.js';
import { calculatePasswordStrength, PasswordStrengthResult } from '../utils/passwordStrength.js';
import {
  AuthEntity,
  AuthCreateData,
  AuthUpdateData,
  AuthOperationInterface,
  UserRegisterData,
  UserLoginData
} from '../types/auth.js';
import { OperationResult, ValidationResult } from '../types/base.js';

/**
 * 認証操作クラス
 * BaseOperationを継承し、認証固有の操作を実装
 */
export class AuthOperation 
  extends BaseOperation<AuthEntity, AuthCreateData, AuthUpdateData>
  implements AuthOperationInterface {

  protected logger = createLogger(LogCategory.OPERATION, 'AuthOperation');

  constructor() {
    super(AuthModel as any, authSchema as any);
  }

  /**
   * ユーザー登録
   */
  async register(data: UserRegisterData): Promise<OperationResult<AuthEntity>> {
    try {
      this.logger.debug('register called', { username: data.username });
      
      // 登録データのバリデーション
      const validation = this.validateRegister(data);
      if (!validation.isValid) {
        this.logger.warn('Registration validation failed', { errors: validation.errors });
        return {
          success: false,
          errors: validation.errors
        };
      }

      // パスワード確認のチェック
      if (data.confirmPassword && data.password !== data.confirmPassword) {
        this.logger.warn('Password confirmation mismatch');
        return {
          success: false,
          error: 'パスワードが一致しません'
        };
      }

      // ユーザー名の重複チェック
      const existingUser = await this.findByUsername(data.username);
      if (existingUser.success) {
        this.logger.warn('Username already exists', { username: data.username });
        return {
          success: false,
          error: 'このユーザー名は既に使用されています'
        };
      }

      // Repository層での登録処理
      const result = await authRepository.register(data);
      
      if (result.success && result.data) {
        this.logger.info('User registered successfully', {
          username: data.username,
          userId: result.data._id
        });
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error during registration', error, { username: data.username });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * ユーザーログイン
   */
  async login(data: UserLoginData): Promise<OperationResult<AuthEntity>> {
    try {
      this.logger.debug('login called', { username: data.username });
      
      // ログインデータのバリデーション
      const validation = this.validateLogin(data);
      if (!validation.isValid) {
        this.logger.warn('Login validation failed', { errors: validation.errors });
        return {
          success: false,
          errors: validation.errors
        };
      }

      // Repository層でのログイン処理
      const result = await authRepository.login(data);
      
      if (result.success && result.data) {
        this.logger.info('User logged in successfully', {
          username: data.username,
          userId: result.data._id
        });
      } else {
        this.logger.warn('Login failed', { username: data.username });
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error during login', error, { username: data.username });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * ユーザー名でユーザーを検索
   */
  async findByUsername(username: string): Promise<OperationResult<AuthEntity>> {
    try {
      this.logger.debug('findByUsername called', { username });
      
      if (!username || typeof username !== 'string') {
        return {
          success: false,
          error: 'ユーザー名は必須で、文字列である必要があります'
        };
      }

      const result = await authRepository.findByUsername(username.trim());
      return result;
    } catch (error) {
      this.logger.error('Error finding user by username', error, { username });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * パスワードの検証
   */
  async verifyPassword(username: string, password: string): Promise<OperationResult<boolean>> {
    try {
      this.logger.debug('verifyPassword called', { username });
      
      if (!username || !password) {
        return {
          success: false,
          error: 'ユーザー名とパスワードは必須です'
        };
      }

      const result = await authRepository.verifyPassword(username, password);
      return result;
    } catch (error) {
      this.logger.error('Error verifying password', error, { username });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * JWT トークンの生成
   */
  generateJWTToken(userData: AuthEntity, fastifyInstance?: any): string | null {
    try {
      if (!fastifyInstance || !fastifyInstance.jwt) {
        this.logger.error('JWT instance not available');
        return null;
      }

      const payload = {
        userId: userData._id,
        username: userData.username,
        iat: Math.floor(Date.now() / 1000)
      };

      const token = fastifyInstance.jwt.sign(payload);
      this.logger.info('JWT token generated', { username: userData.username });
      
      return token;
    } catch (error) {
      this.logger.error('Error generating JWT token', error, { username: userData.username });
      return null;
    }
  }

  /**
   * JWT トークンの検証
   */
  async verifyJWTToken(token: string, fastifyInstance?: any): Promise<OperationResult<any>> {
    try {
      if (!fastifyInstance || !fastifyInstance.jwt) {
        return {
          success: false,
          error: 'JWT instance not available'
        };
      }

      const decoded = fastifyInstance.jwt.verify(token);
      this.logger.debug('JWT token verified', { userId: decoded.userId });
      
      return {
        success: true,
        data: decoded
      };
    } catch (error) {
      this.logger.warn('JWT token verification failed', error);
      return {
        success: false,
        error: 'Invalid or expired token'
      };
    }
  }

  /**
   * 認証が必要なリクエストのミドルウェア用ヘルパー
   */
  async authenticateRequest(request: any, fastifyInstance?: any): Promise<OperationResult<AuthEntity>> {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
          success: false,
          error: 'Authorization header missing or invalid'
        };
      }

      const token = authHeader.substring(7);
      const tokenResult = await this.verifyJWTToken(token, fastifyInstance);
      
      if (!tokenResult.success || !tokenResult.data) {
        return {
          success: false,
          error: 'Invalid token'
        };
      }

      // ユーザー情報を取得
      const userResult = await this.findById(tokenResult.data.userId);
      if (!userResult.success) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      return userResult;
    } catch (error) {
      this.logger.error('Error authenticating request', error);
      return {
        success: false,
        error: 'Authentication failed'
      };
    }
  }

  /**
   * パスワード強度チェック
   */
  checkPasswordStrength(password: string): PasswordStrengthResult {
    return calculatePasswordStrength(password);
  }

  /**
   * ユーザー統計の取得
   */
  async getUserStatistics(): Promise<OperationResult<{
    totalUsers: number;
    recentRegistrations: number;
    activeUsers: number;
  }>> {
    try {
      const totalUsersResult = await this.count();
      if (!totalUsersResult.success) {
        return {
          success: false,
          error: 'Failed to get total user count'
        };
      }

      // 過去30日間の新規登録者数
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentUsers = await this.model.countDocuments({
        createdAt: { $gte: thirtyDaysAgo }
      });

      return {
        success: true,
        data: {
          totalUsers: totalUsersResult.data!,
          recentRegistrations: recentUsers,
          activeUsers: totalUsersResult.data! // 簡単な実装として全ユーザー数を使用
        }
      };
    } catch (error) {
      this.logger.error('Error getting user statistics', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * 登録データのバリデーション
   */
  validateRegister(data: unknown): ValidationResult<UserRegisterData> {
    return authRepository.validateRegister(data);
  }

  /**
   * ログインデータのバリデーション
   */
  validateLogin(data: unknown): ValidationResult<UserLoginData> {
    return authRepository.validateLogin(data);
  }

  /**
   * ユーザー作成（オーバーライド）
   * 追加のビジネスロジックを含む
   */
  async create(data: AuthCreateData): Promise<OperationResult<AuthEntity>> {
    try {
      this.logger.debug('create called', { username: data.username });
      
      // ユーザー名の重複チェック
      const existingUser = await this.findByUsername(data.username);
      if (existingUser.success) {
        this.logger.warn('Username already exists', { username: data.username });
        return {
          success: false,
          error: 'このユーザー名は既に使用されています'
        };
      }

      // Repository層での作成処理
      const result = await authRepository.create(data);
      
      if (result.success && result.data) {
        this.logger.info('User created successfully', {
          username: data.username,
          userId: result.data._id
        });
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error creating user', error, { username: data.username });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * 更新データのサニタイズ（オーバーライド）
   */
  protected sanitizeUpdateData(data: AuthUpdateData): Partial<AuthUpdateData> {
    const sanitized = super.sanitizeUpdateData(data);
    
    // パスワードフィールドがある場合の特別な処理
    if (sanitized.password !== undefined) {
      // パスワードの長さチェック
      if (!sanitized.password || sanitized.password.length < 6) {
        delete sanitized.password;
      }
    }
    
    return sanitized;
  }
}

// シングルトンインスタンス
export const authOperation = new AuthOperation();

export default authOperation;
