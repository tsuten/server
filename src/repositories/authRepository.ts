import { AuthModel, AuthDocument } from '../models/AuthModel.js';
import {
  AuthEntity,
  AuthCreateData,
  AuthUpdateData,
  UserRegisterData,
  UserLoginData,
  AuthOperationInterface
} from '../types/auth.js';
import { OperationResult, ValidationResult, ValidationError } from '../types/base.js';
import bcrypt from 'bcrypt';

/**
 * AuthRepository クラス
 * 認証関連のデータベース操作を担当するRepository層
 */
export class AuthRepository implements AuthOperationInterface {

  /**
   * ユーザーを作成
   */
  async create(data: AuthCreateData): Promise<OperationResult<AuthEntity>> {
    try {
      // バリデーション
      const validation = this.validate(data);
      if (!validation.isValid) {
        return this.createErrorResult('Validation failed', validation.errors);
      }

      // ユーザー名の重複チェック
      const existingUser = await this.findByUsername(data.username);
      if (existingUser.success) {
        return this.createErrorResult('Username already exists');
      }

      // パスワードのハッシュ化
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(data.password, saltRounds);

      const authData = {
        ...data,
        password: hashedPassword
      };

      const auth = new AuthModel(authData);
      const savedAuth = await auth.save();
      
      return this.createSuccessResult(savedAuth.toJSON());
    } catch (error) {
      console.error('Error creating user:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * IDでユーザーを取得
   */
  async findById(id: string): Promise<OperationResult<AuthEntity>> {
    try {
      if (!id) {
        return this.createErrorResult('User ID is required');
      }

      const user = await AuthModel.findById(id).lean();
      
      if (!user) {
        return this.createErrorResult('User not found');
      }

      return this.createSuccessResult(user as AuthEntity);
    } catch (error) {
      console.error('Error finding user by ID:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザー名でユーザーを取得
   */
  async findByUsername(username: string): Promise<OperationResult<AuthEntity>> {
    try {
      if (!username || typeof username !== 'string') {
        return this.createErrorResult('Username is required and must be a string');
      }

      const user = await AuthModel.findOne({ username: username.trim() }).lean();
      
      if (!user) {
        return this.createErrorResult('User not found');
      }

      return this.createSuccessResult(user as AuthEntity);
    } catch (error) {
      console.error('Error finding user by username:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザーを更新
   */
  async update(id: string, data: AuthUpdateData): Promise<OperationResult<AuthEntity>> {
    try {
      if (!id) {
        return this.createErrorResult('User ID is required');
      }

      // パスワードが含まれている場合はハッシュ化
      const updateData = { ...data };
      if (data.password) {
        const saltRounds = 10;
        updateData.password = await bcrypt.hash(data.password, saltRounds);
      }

      // ユーザー名の重複チェック（自分以外のユーザーで同じユーザー名がないか）
      if (data.username) {
        const existingUser = await AuthModel.findOne({ 
          username: data.username.trim(),
          _id: { $ne: id }
        }).lean();
        
        if (existingUser) {
          return this.createErrorResult('Username already exists');
        }
      }

      const updatedUser = await AuthModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).lean();

      if (!updatedUser) {
        return this.createErrorResult('User not found');
      }

      return this.createSuccessResult(updatedUser as AuthEntity);
    } catch (error) {
      console.error('Error updating user:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザーを削除
   */
  async delete(id: string): Promise<OperationResult<AuthEntity>> {
    try {
      if (!id) {
        return this.createErrorResult('User ID is required');
      }

      const deletedUser = await AuthModel.findByIdAndDelete(id).lean();

      if (!deletedUser) {
        return this.createErrorResult('User not found');
      }

      return this.createSuccessResult(deletedUser as AuthEntity);
    } catch (error) {
      console.error('Error deleting user:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザー登録
   */
  async register(data: UserRegisterData): Promise<OperationResult<AuthEntity>> {
    try {
      // 登録用のバリデーション
      const validation = this.validateRegister(data);
      if (!validation.isValid) {
        return this.createErrorResult('Validation failed', validation.errors);
      }

      // パスワード確認のチェック
      if (data.confirmPassword && data.password !== data.confirmPassword) {
        return this.createErrorResult('Passwords do not match');
      }

      // 通常の作成処理を呼び出し
      const createData: AuthCreateData = {
        username: data.username,
        password: data.password
      };

      return await this.create(createData);
    } catch (error) {
      console.error('Error registering user:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザーログイン
   */
  async login(data: UserLoginData): Promise<OperationResult<AuthEntity>> {
    try {
      // ログイン用のバリデーション
      const validation = this.validateLogin(data);
      if (!validation.isValid) {
        return this.createErrorResult('Validation failed', validation.errors);
      }

      // ユーザーの存在確認
      const userResult = await this.findByUsername(data.username);
      if (!userResult.success || !userResult.data) {
        return this.createErrorResult('Invalid username or password');
      }

      // パスワードの検証
      const isPasswordValid = await bcrypt.compare(data.password, userResult.data.password);
      if (!isPasswordValid) {
        return this.createErrorResult('Invalid username or password');
      }

      return this.createSuccessResult(userResult.data);
    } catch (error) {
      console.error('Error during login:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * パスワードの検証
   */
  async verifyPassword(username: string, password: string): Promise<OperationResult<boolean>> {
    try {
      if (!username || !password) {
        return this.createErrorResult('Username and password are required');
      }

      const userResult = await this.findByUsername(username);
      if (!userResult.success || !userResult.data) {
        return this.createSuccessResult(false);
      }

      const isPasswordValid = await bcrypt.compare(password, userResult.data.password);
      return this.createSuccessResult(isPasswordValid);
    } catch (error) {
      console.error('Error verifying password:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 基本バリデーション
   */
  validate(data: unknown): ValidationResult<AuthCreateData> {
    try {
      const createData = data as AuthCreateData;
      const errors: ValidationError[] = [];

      if (!createData.username || typeof createData.username !== 'string' || createData.username.trim().length === 0) {
        errors.push({ field: 'username', message: 'Username is required' });
      }

      if (!createData.password || typeof createData.password !== 'string' || createData.password.length === 0) {
        errors.push({ field: 'password', message: 'Password is required' });
      }

      if (createData.username && createData.username.length < 3) {
        errors.push({ field: 'username', message: 'Username must be at least 3 characters long' });
      }

      if (createData.username && createData.username.length > 50) {
        errors.push({ field: 'username', message: 'Username must be less than 50 characters' });
      }

      if (createData.password && createData.password.length < 6) {
        errors.push({ field: 'password', message: 'Password must be at least 6 characters long' });
      }

      if (createData.password && createData.password.length > 100) {
        errors.push({ field: 'password', message: 'Password must be less than 100 characters' });
      }

      // ユーザー名の文字制限チェック（英数字とアンダースコアのみ）
      if (createData.username && !/^[a-zA-Z0-9_]+$/.test(createData.username)) {
        errors.push({ field: 'username', message: 'Username can only contain letters, numbers, and underscores' });
      }

      return {
        isValid: errors.length === 0,
        errors,
        data: errors.length === 0 ? createData : null
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{ field: 'general', message: 'Invalid data format' }],
        data: null
      };
    }
  }

  /**
   * ログインバリデーション
   */
  validateLogin(data: unknown): ValidationResult<UserLoginData> {
    try {
      const loginData = data as UserLoginData;
      const errors: ValidationError[] = [];

      if (!loginData.username || typeof loginData.username !== 'string' || loginData.username.trim().length === 0) {
        errors.push({ field: 'username', message: 'Username is required' });
      }

      if (!loginData.password || typeof loginData.password !== 'string' || loginData.password.length === 0) {
        errors.push({ field: 'password', message: 'Password is required' });
      }

      return {
        isValid: errors.length === 0,
        errors,
        data: errors.length === 0 ? loginData : null
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{ field: 'general', message: 'Invalid data format' }],
        data: null
      };
    }
  }

  /**
   * 登録バリデーション
   */
  validateRegister(data: unknown): ValidationResult<UserRegisterData> {
    try {
      const registerData = data as UserRegisterData;
      const errors: ValidationError[] = [];

      // 基本バリデーションを実行
      const baseValidation = this.validate(registerData);
      errors.push(...baseValidation.errors);

      // 確認パスワードのチェック
      if (registerData.confirmPassword !== undefined) {
        if (registerData.confirmPassword !== registerData.password) {
          errors.push({ field: 'confirmPassword', message: 'Password confirmation does not match' });
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        data: errors.length === 0 ? registerData : null
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{ field: 'general', message: 'Invalid data format' }],
        data: null
      };
    }
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
export const authRepository = new AuthRepository();

export default authRepository;
