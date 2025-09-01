import { BaseEntity, OperationResult, ValidationResult } from './base.js';

/**
 * 認証エンティティの基本構造
 */
export interface AuthEntity extends BaseEntity {
    username: string;
    password: string;
}

/**
 * 認証作成データ
 */
export interface AuthCreateData {
    username: string;
    password: string;
}

/**
 * 認証更新データ
 */
export interface AuthUpdateData {
    username?: string;
    password?: string;
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
 * 認証操作インターフェース
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