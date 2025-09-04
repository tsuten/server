import { BaseEntity, OperationResult, ValidationResult } from './base.js';

/**
 * 認証エンティティの基本構造
 */
export interface AuthEntity extends BaseEntity {
    username: string;
    password: string;
    is_admin?: boolean;
    password2?: string;
    email?: string;
}

/**
 * 認証作成データ
 */
export interface AuthCreateData {
    username: string;
    password: string;
    is_admin?: boolean;
    password2?: string;
    email?: string;
}

/**
 * 認証更新データ
 */
export interface AuthUpdateData {
    username?: string;
    password?: string;
    is_admin?: boolean;
    password2?: string;
    email?: string;
}

/**
 * ユーザー登録データ
 */
export interface UserRegisterData extends AuthCreateData {
    confirmPassword?: string;
}

/**
 * ユーザーログインデータ
 */
export interface UserLoginData {
    username: string;
    password: string;
}

/**
 * 管理者作成データ
 */
export interface AdminCreateData {
    username: string;
    password: string;
    password2?: string;
    email: string;
    is_admin: true;
}

/**
 * 管理者更新データ
 */
export interface AdminUpdateData {
    username?: string;
    password?: string;
    password2?: string;
    email?: string;
    is_admin?: boolean;
}

/**
 * 認証操作インターフェース（一般ユーザー用）
 */
export interface AuthOperationInterface {
    // 基本的なCRUD操作
    create(data: AuthCreateData): Promise<OperationResult<AuthEntity>>;
    findById(id: string): Promise<OperationResult<AuthEntity>>;
    update(id: string, data: AuthUpdateData): Promise<OperationResult<AuthEntity>>;
    delete(id: string): Promise<OperationResult<AuthEntity>>;
    
    // 認証固有の操作
    findByUsername(username: string): Promise<OperationResult<AuthEntity>>;
    register(data: UserRegisterData): Promise<OperationResult<AuthEntity>>;
    login(data: UserLoginData): Promise<OperationResult<AuthEntity>>;
    verifyPassword(username: string, password: string): Promise<OperationResult<boolean>>;
    
    // バリデーション
    validate(data: unknown): ValidationResult<AuthCreateData>;
    validateLogin(data: unknown): ValidationResult<UserLoginData>;
    validateRegister(data: unknown): ValidationResult<UserRegisterData>;
}

/**
 * 管理者ログインデータ
 */
export interface AdminLoginData {
    username: string;
    password: string;
    password2?: string; // 二段階認証用
}

/**
 * 管理者操作インターフェース
 */
export interface AdminOperationInterface {
    // 管理者専用CRUD操作
    createAdmin(data: AdminCreateData): Promise<OperationResult<AuthEntity>>;
    findAdminById(id: string): Promise<OperationResult<AuthEntity>>;
    findAdminByUsername(username: string): Promise<OperationResult<AuthEntity>>;
    findAdminByEmail(email: string): Promise<OperationResult<AuthEntity>>;
    updateAdmin(id: string, data: AdminUpdateData): Promise<OperationResult<AuthEntity>>;
    deleteAdmin(id: string): Promise<OperationResult<AuthEntity>>;
    
    // 管理者認証
    adminLogin(data: AdminLoginData): Promise<OperationResult<AuthEntity>>;
    verifyAdminPassword(username: string, password: string, password2?: string): Promise<OperationResult<boolean>>;
    
    // 管理者リスト操作
    getAllAdmins(): Promise<OperationResult<AuthEntity[]>>;
    getAllUsers(): Promise<OperationResult<AuthEntity[]>>;
    
    // 権限管理
    promoteToAdmin(userId: string): Promise<OperationResult<AuthEntity>>;
    demoteFromAdmin(adminId: string): Promise<OperationResult<AuthEntity>>;
    isAdmin(userId: string): Promise<OperationResult<boolean>>;
    
    // 管理者専用バリデーション
    validateAdmin(data: unknown): ValidationResult<AdminCreateData>;
    validateAdminUpdate(data: unknown): ValidationResult<AdminUpdateData>;
    validateAdminLogin(data: unknown): ValidationResult<AdminLoginData>;
}