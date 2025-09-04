import { AuthModel, AuthDocument } from '../models/AuthModel.js';
import {
  AuthEntity,
  AuthCreateData,
  AuthUpdateData,
  UserRegisterData,
  UserLoginData,
  AuthOperationInterface,
  AdminCreateData,
  AdminUpdateData,
  AdminOperationInterface,
  AdminLoginData
} from '../types/auth.js';
import { OperationResult, ValidationResult, ValidationError } from '../types/base.js';
import bcrypt from 'bcrypt';

/**
 * AuthRepository クラス
 * 一般ユーザー認証関連のデータベース操作を担当するRepository層
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
        password: hashedPassword,
        is_admin: false // 一般ユーザーは必ず管理者でない
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

      const user = await AuthModel.findById(id).where({ is_admin: { $ne: true } }).lean();
      
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

      const user = await AuthModel.findOne({ username: username.trim(), is_admin: { $ne: true } }).lean();
      
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
      
      // 一般ユーザーが管理者権限を変更することを防ぐ
      delete updateData.is_admin;

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

      const updatedUser = await AuthModel.findOneAndUpdate(
        { _id: id, is_admin: { $ne: true } },
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

      const deletedUser = await AuthModel.findOneAndDelete({ _id: id, is_admin: { $ne: true } }).lean();

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
        password: data.password,
        is_admin: false // 登録ユーザーは必ず一般ユーザー
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

/**
 * AdminRepository クラス
 * 管理者認証関連のデータベース操作を担当するRepository層
 */
export class AdminRepository implements AdminOperationInterface {

  /**
   * 管理者を作成
   */
  async createAdmin(data: AdminCreateData): Promise<OperationResult<AuthEntity>> {
    try {
      // バリデーション
      const validation = this.validateAdmin(data);
      if (!validation.isValid) {
        return this.createErrorResult('Validation failed', validation.errors);
      }

      // ユーザー名の重複チェック
      const existingUser = await AuthModel.findOne({ username: data.username });
      if (existingUser) {
        return this.createErrorResult('Username already exists');
      }

      // メールアドレスの重複チェック
      const existingEmail = await AuthModel.findOne({ email: data.email });
      if (existingEmail) {
        return this.createErrorResult('Email already exists');
      }

      // パスワードのハッシュ化
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(data.password, saltRounds);
      
      let hashedPassword2;
      if (data.password2) {
        hashedPassword2 = await bcrypt.hash(data.password2, saltRounds);
      }

      const adminData = {
        username: data.username,
        password: hashedPassword,
        password2: hashedPassword2,
        email: data.email,
        is_admin: true
      };

      const admin = new AuthModel(adminData);
      const savedAdmin = await admin.save();
      
      return this.createSuccessResult(savedAdmin.toJSON());
    } catch (error) {
      console.error('Error creating admin:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * IDで管理者を取得
   */
  async findAdminById(id: string): Promise<OperationResult<AuthEntity>> {
    try {
      if (!id) {
        return this.createErrorResult('Admin ID is required');
      }

      const admin = await AuthModel.findById(id).where({ is_admin: true }).lean();
      
      if (!admin) {
        return this.createErrorResult('Admin not found');
      }

      return this.createSuccessResult(admin as AuthEntity);
    } catch (error) {
      console.error('Error finding admin by ID:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザー名で管理者を取得
   */
  async findAdminByUsername(username: string): Promise<OperationResult<AuthEntity>> {
    try {
      if (!username || typeof username !== 'string') {
        return this.createErrorResult('Username is required and must be a string');
      }

      const admin = await AuthModel.findOne({ 
        username: username.trim(), 
        is_admin: true 
      }).lean();
      
      if (!admin) {
        return this.createErrorResult('Admin not found');
      }

      return this.createSuccessResult(admin as AuthEntity);
    } catch (error) {
      console.error('Error finding admin by username:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * メールアドレスで管理者を取得
   */
  async findAdminByEmail(email: string): Promise<OperationResult<AuthEntity>> {
    try {
      if (!email || typeof email !== 'string') {
        return this.createErrorResult('Email is required and must be a string');
      }

      const admin = await AuthModel.findOne({ 
        email: email.trim(), 
        is_admin: true 
      }).lean();
      
      if (!admin) {
        return this.createErrorResult('Admin not found');
      }

      return this.createSuccessResult(admin as AuthEntity);
    } catch (error) {
      console.error('Error finding admin by email:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 管理者を更新
   */
  async updateAdmin(id: string, data: AdminUpdateData): Promise<OperationResult<AuthEntity>> {
    try {
      if (!id) {
        return this.createErrorResult('Admin ID is required');
      }

      // バリデーション
      const validation = this.validateAdminUpdate(data);
      if (!validation.isValid) {
        return this.createErrorResult('Validation failed', validation.errors);
      }

      // パスワードが含まれている場合はハッシュ化
      const updateData = { ...data };
      if (data.password) {
        const saltRounds = 10;
        updateData.password = await bcrypt.hash(data.password, saltRounds);
      }
      
      if (data.password2) {
        const saltRounds = 10;
        updateData.password2 = await bcrypt.hash(data.password2, saltRounds);
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

      // メールアドレスの重複チェック
      if (data.email) {
        const existingEmail = await AuthModel.findOne({ 
          email: data.email.trim(),
          _id: { $ne: id }
        }).lean();
        
        if (existingEmail) {
          return this.createErrorResult('Email already exists');
        }
      }

      const updatedAdmin = await AuthModel.findOneAndUpdate(
        { _id: id, is_admin: true },
        { $set: updateData },
        { new: true, runValidators: true }
      ).lean();

      if (!updatedAdmin) {
        return this.createErrorResult('Admin not found');
      }

      return this.createSuccessResult(updatedAdmin as AuthEntity);
    } catch (error) {
      console.error('Error updating admin:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 管理者を削除
   */
  async deleteAdmin(id: string): Promise<OperationResult<AuthEntity>> {
    try {
      if (!id) {
        return this.createErrorResult('Admin ID is required');
      }

      const deletedAdmin = await AuthModel.findOneAndDelete({ 
        _id: id, 
        is_admin: true 
      }).lean();

      if (!deletedAdmin) {
        return this.createErrorResult('Admin not found');
      }

      return this.createSuccessResult(deletedAdmin as AuthEntity);
    } catch (error) {
      console.error('Error deleting admin:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 全ての管理者を取得
   */
  async getAllAdmins(): Promise<OperationResult<AuthEntity[]>> {
    try {
      const admins = await AuthModel.find({ is_admin: true }).lean();
      return this.createSuccessResult(admins as AuthEntity[]);
    } catch (error) {
      console.error('Error getting all admins:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 全ての一般ユーザーを取得
   */
  async getAllUsers(): Promise<OperationResult<AuthEntity[]>> {
    try {
      const users = await AuthModel.find({ is_admin: { $ne: true } }).lean();
      return this.createSuccessResult(users as AuthEntity[]);
    } catch (error) {
      console.error('Error getting all users:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザーを管理者に昇格
   */
  async promoteToAdmin(userId: string): Promise<OperationResult<AuthEntity>> {
    try {
      if (!userId) {
        return this.createErrorResult('User ID is required');
      }

      const updatedUser = await AuthModel.findByIdAndUpdate(
        userId,
        { $set: { is_admin: true } },
        { new: true, runValidators: true }
      ).lean();

      if (!updatedUser) {
        return this.createErrorResult('User not found');
      }

      return this.createSuccessResult(updatedUser as AuthEntity);
    } catch (error) {
      console.error('Error promoting user to admin:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 管理者を一般ユーザーに降格
   */
  async demoteFromAdmin(adminId: string): Promise<OperationResult<AuthEntity>> {
    try {
      if (!adminId) {
        return this.createErrorResult('Admin ID is required');
      }

      const updatedAdmin = await AuthModel.findOneAndUpdate(
        { _id: adminId, is_admin: true },
        { $set: { is_admin: false } },
        { new: true, runValidators: true }
      ).lean();

      if (!updatedAdmin) {
        return this.createErrorResult('Admin not found');
      }

      return this.createSuccessResult(updatedAdmin as AuthEntity);
    } catch (error) {
      console.error('Error demoting admin:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザーが管理者かチェック
   */
  async isAdmin(userId: string): Promise<OperationResult<boolean>> {
    try {
      if (!userId) {
        return this.createErrorResult('User ID is required');
      }

      const user = await AuthModel.findById(userId).lean();
      
      if (!user) {
        return this.createErrorResult('User not found');
      }

      return this.createSuccessResult(user.is_admin === true);
    } catch (error) {
      console.error('Error checking admin status:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 管理者専用ログイン
   */
  async adminLogin(data: AdminLoginData): Promise<OperationResult<AuthEntity>> {
    try {
      // ログイン用のバリデーション
      const validation = this.validateAdminLogin(data);
      if (!validation.isValid) {
        return this.createErrorResult('Validation failed', validation.errors);
      }

      // 管理者の存在確認（is_admin=trueのみ）
      const adminResult = await this.findAdminByUsername(data.username);
      if (!adminResult.success || !adminResult.data) {
        return this.createErrorResult('Invalid admin credentials');
      }

      // メインパスワードの検証
      const isPasswordValid = await bcrypt.compare(data.password, adminResult.data.password);
      if (!isPasswordValid) {
        return this.createErrorResult('Invalid admin credentials');
      }

      // セカンダリパスワードが設定されている場合の検証
      if (adminResult.data.password2) {
        if (!data.password2) {
          return this.createErrorResult('Secondary password is required');
        }
        
        const isPassword2Valid = await bcrypt.compare(data.password2, adminResult.data.password2);
        if (!isPassword2Valid) {
          return this.createErrorResult('Invalid admin credentials');
        }
      }

      return this.createSuccessResult(adminResult.data);
    } catch (error) {
      console.error('Error during admin login:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 管理者パスワードの検証
   */
  async verifyAdminPassword(username: string, password: string, password2?: string): Promise<OperationResult<boolean>> {
    try {
      if (!username || !password) {
        return this.createErrorResult('Username and password are required');
      }

      const adminResult = await this.findAdminByUsername(username);
      if (!adminResult.success || !adminResult.data) {
        return this.createSuccessResult(false);
      }

      // メインパスワードの検証
      const isPasswordValid = await bcrypt.compare(password, adminResult.data.password);
      if (!isPasswordValid) {
        return this.createSuccessResult(false);
      }

      // セカンダリパスワードの検証（設定されている場合）
      if (adminResult.data.password2) {
        if (!password2) {
          return this.createSuccessResult(false);
        }
        
        const isPassword2Valid = await bcrypt.compare(password2, adminResult.data.password2);
        return this.createSuccessResult(isPassword2Valid);
      }

      return this.createSuccessResult(true);
    } catch (error) {
      console.error('Error verifying admin password:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 管理者作成バリデーション
   */
  validateAdmin(data: unknown): ValidationResult<AdminCreateData> {
    try {
      const adminData = data as AdminCreateData;
      const errors: ValidationError[] = [];

      // 基本バリデーション
      if (!adminData.username || typeof adminData.username !== 'string' || adminData.username.trim().length === 0) {
        errors.push({ field: 'username', message: 'Username is required' });
      }

      if (!adminData.password || typeof adminData.password !== 'string' || adminData.password.length === 0) {
        errors.push({ field: 'password', message: 'Password is required' });
      }

      if (!adminData.email || typeof adminData.email !== 'string' || adminData.email.trim().length === 0) {
        errors.push({ field: 'email', message: 'Email is required' });
      }

      // 詳細バリデーション
      if (adminData.username && adminData.username.length < 3) {
        errors.push({ field: 'username', message: 'Username must be at least 3 characters long' });
      }

      if (adminData.username && adminData.username.length > 50) {
        errors.push({ field: 'username', message: 'Username must be less than 50 characters' });
      }

      if (adminData.password && adminData.password.length < 8) {
        errors.push({ field: 'password', message: 'Admin password must be at least 8 characters long' });
      }

      if (adminData.password && adminData.password.length > 100) {
        errors.push({ field: 'password', message: 'Password must be less than 100 characters' });
      }

      // ユーザー名の文字制限チェック
      if (adminData.username && !/^[a-zA-Z0-9_]+$/.test(adminData.username)) {
        errors.push({ field: 'username', message: 'Username can only contain letters, numbers, and underscores' });
      }

      // メールアドレスの形式チェック
      if (adminData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminData.email)) {
        errors.push({ field: 'email', message: 'Invalid email format' });
      }

      // password2のバリデーション
      if (adminData.password2) {
        if (typeof adminData.password2 !== 'string' || adminData.password2.length < 8) {
          errors.push({ field: 'password2', message: 'Secondary password must be at least 8 characters long' });
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        data: errors.length === 0 ? adminData : null
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
   * 管理者更新バリデーション
   */
  validateAdminUpdate(data: unknown): ValidationResult<AdminUpdateData> {
    try {
      const updateData = data as AdminUpdateData;
      const errors: ValidationError[] = [];

      // オプションフィールドのバリデーション
      if (updateData.username !== undefined) {
        if (typeof updateData.username !== 'string' || updateData.username.trim().length === 0) {
          errors.push({ field: 'username', message: 'Username must be a non-empty string' });
        } else if (updateData.username.length < 3) {
          errors.push({ field: 'username', message: 'Username must be at least 3 characters long' });
        } else if (updateData.username.length > 50) {
          errors.push({ field: 'username', message: 'Username must be less than 50 characters' });
        } else if (!/^[a-zA-Z0-9_]+$/.test(updateData.username)) {
          errors.push({ field: 'username', message: 'Username can only contain letters, numbers, and underscores' });
        }
      }

      if (updateData.password !== undefined) {
        if (typeof updateData.password !== 'string' || updateData.password.length === 0) {
          errors.push({ field: 'password', message: 'Password must be a non-empty string' });
        } else if (updateData.password.length < 8) {
          errors.push({ field: 'password', message: 'Admin password must be at least 8 characters long' });
        } else if (updateData.password.length > 100) {
          errors.push({ field: 'password', message: 'Password must be less than 100 characters' });
        }
      }

      if (updateData.email !== undefined) {
        if (typeof updateData.email !== 'string' || updateData.email.trim().length === 0) {
          errors.push({ field: 'email', message: 'Email must be a non-empty string' });
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updateData.email)) {
          errors.push({ field: 'email', message: 'Invalid email format' });
        }
      }

      if (updateData.password2 !== undefined) {
        if (typeof updateData.password2 !== 'string' || updateData.password2.length < 8) {
          errors.push({ field: 'password2', message: 'Secondary password must be at least 8 characters long' });
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        data: errors.length === 0 ? updateData : null
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
   * 管理者ログインバリデーション
   */
  validateAdminLogin(data: unknown): ValidationResult<AdminLoginData> {
    try {
      const loginData = data as AdminLoginData;
      const errors: ValidationError[] = [];

      if (!loginData.username || typeof loginData.username !== 'string' || loginData.username.trim().length === 0) {
        errors.push({ field: 'username', message: 'Username is required' });
      }

      if (!loginData.password || typeof loginData.password !== 'string' || loginData.password.length === 0) {
        errors.push({ field: 'password', message: 'Password is required' });
      }

      // password2の検証（提供された場合）
      if (loginData.password2 !== undefined) {
        if (typeof loginData.password2 !== 'string' || loginData.password2.length === 0) {
          errors.push({ field: 'password2', message: 'Secondary password must be a non-empty string' });
        }
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
export const adminRepository = new AdminRepository();

export default authRepository;
