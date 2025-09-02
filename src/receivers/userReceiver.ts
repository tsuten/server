import { BaseReceiver, ReceiverOptions } from '../base/BaseReceiver.js';
import { userOperation } from '../operations/userOperation.js';
import { CustomSocket } from '../types/socket.js';
import { Server } from 'socket.io';
import { createLogger, LogCategory } from '../utils/consoleLog.js';
import {
  UserEntity,
  UserCreateData,
  UserUpdateData,
  UserOperationInterface,
  UserType,
  UserSettings
} from '../types/user.js';

/**
 * ユーザーレシーバークラス
 * Socket.io通信でのユーザー関連操作を処理
 */
export class UserReceiver extends BaseReceiver<UserEntity, UserCreateData, UserUpdateData> {
  protected declare socket: CustomSocket;
  private userOp = userOperation;
  protected logger = createLogger(LogCategory.RECEIVER, 'UserReceiver');
  
  constructor(io: Server, socket: CustomSocket, options: ReceiverOptions = {}) {
    super(io, socket, userOperation, options);
  }

  /**
   * カスタムイベントハンドラーを設定
   */
  protected setupEventHandlers(): void {
    // ユーザー情報取得
    this.addEventHandler('getUserInfo', this.handleGetUserInfo.bind(this));
    
    // ユーザー作成
    this.addEventHandler('createUser', this.handleCreateUser.bind(this));
    
    // ユーザー更新
    this.addEventHandler('updateUser', this.handleUpdateUser.bind(this));
    
    // ユーザー削除
    this.addEventHandler('deleteUser', this.handleDeleteUser.bind(this));
    
    // ユーザー検索
    this.addEventHandler('searchUsers', this.handleSearchUsers.bind(this));
    
    // オンラインユーザー取得
    this.addEventHandler('getOnlineUsers', this.handleGetOnlineUsers.bind(this));
    
    // ユーザータイプ別取得
    this.addEventHandler('getUsersByType', this.handleGetUsersByType.bind(this));
    
    // オンライン状態更新
    this.addEventHandler('updateOnlineStatus', this.handleUpdateOnlineStatus.bind(this));
    
    // ユーザー設定更新
    this.addEventHandler('updateUserSettings', this.handleUpdateUserSettings.bind(this));
    
    // ユーザータイプ更新
    this.addEventHandler('updateUserType', this.handleUpdateUserType.bind(this));
    
    // ユーザー統計取得
    this.addEventHandler('getUserStatistics', this.handleGetUserStatistics.bind(this));
    
    // ユーザー一覧取得
    this.addEventHandler('getUsers', this.handleGetUsers.bind(this));
    
    // 認証IDでユーザー取得
    this.addEventHandler('getUserByAuthId', this.handleGetUserByAuthId.bind(this));
    
    // メールアドレスでユーザー検索
    this.addEventHandler('getUserByEmail', this.handleGetUserByEmail.bind(this));
  }

  /**
   * ユーザー情報取得ハンドラー
   */
  private async handleGetUserInfo(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { userId } = data;
      
      if (!userId) {
        throw new Error('User ID is required');
      }

      return await this.userOp.findById(userId);
    }, callback);
  }

  /**
   * ユーザー作成ハンドラー
   */
  private async handleCreateUser(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const createData: UserCreateData = {
        authId: data.authId,
        displayName: data.displayName,
        email: data.email,
        avatar: data.avatar,
        type: data.type || 'user',
        settings: data.settings
      };

      const result = await this.userOp.create(createData);
      
      if (result.success) {
        // 全クライアントに新しいユーザー作成を通知
        this.socket.broadcast.emit('userCreated', {
          user: result.data,
          createdBy: this.socket.username,
          timestamp: new Date()
        });
      }
      
      return result;
    }, callback);
  }

  /**
   * ユーザー更新ハンドラー
   */
  private async handleUpdateUser(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { userId, ...updateData } = data;
      
      if (!userId) {
        throw new Error('User ID is required');
      }

      const result = await this.userOp.update(userId, updateData);
      
      if (result.success) {
        // 全クライアントにユーザー更新を通知
        this.socket.broadcast.emit('userUpdated', {
          user: result.data,
          updatedBy: this.socket.username,
          timestamp: new Date()
        });
      }
      
      return result;
    }, callback);
  }

  /**
   * ユーザー削除ハンドラー
   */
  private async handleDeleteUser(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { userId } = data;
      
      if (!userId) {
        throw new Error('User ID is required');
      }

      // 削除前にユーザー情報を取得（通知用）
      const userInfo = await this.userOp.findById(userId);
      const userData = userInfo.success ? userInfo.data : null;

      const result = await this.userOp.delete(userId);
      
      if (result.success) {
        // 全クライアントにユーザー削除を通知
        this.socket.broadcast.emit('userDeleted', {
          userId: userId,
          user: userData,
          deletedBy: this.socket.username,
          timestamp: new Date()
        });
      }
      
      return result;
    }, callback);
  }

  /**
   * ユーザー検索ハンドラー
   */
  private async handleSearchUsers(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { keyword, limit = 50, skip = 0 } = data;
      
      if (!keyword) {
        throw new Error('Search keyword is required');
      }

      return await this.userOp.searchUsers(keyword, { limit, skip });
    }, callback);
  }

  /**
   * オンラインユーザー取得ハンドラー
   */
  private async handleGetOnlineUsers(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { limit = 50, skip = 0 } = data;
      
      return await this.userOp.findOnlineUsers({ limit, skip });
    }, callback);
  }

  /**
   * ユーザータイプ別取得ハンドラー
   */
  private async handleGetUsersByType(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { type, limit = 50, skip = 0 } = data;
      
      if (!type) {
        throw new Error('User type is required');
      }

      return await this.userOp.findByType(type, { limit, skip });
    }, callback);
  }

  /**
   * オンライン状態更新ハンドラー
   */
  private async handleUpdateOnlineStatus(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { userId, isOnline } = data;
      
      if (!userId) {
        throw new Error('User ID is required');
      }

      if (typeof isOnline !== 'boolean') {
        throw new Error('isOnline must be a boolean value');
      }

      const result = await this.userOp.updateOnlineStatus(userId, isOnline);
      
      if (result.success) {
        // 全クライアントにオンライン状態変更を通知
        this.socket.broadcast.emit('userOnlineStatusChanged', {
          userId: userId,
          isOnline: isOnline,
          user: result.data,
          timestamp: new Date()
        });
      }
      
      return result;
    }, callback);
  }

  /**
   * ユーザー設定更新ハンドラー
   */
  private async handleUpdateUserSettings(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { userId, settings } = data;
      
      if (!userId) {
        throw new Error('User ID is required');
      }

      if (!settings || typeof settings !== 'object') {
        throw new Error('Settings must be a valid object');
      }

      const result = await this.userOp.updateUserSettings(userId, settings);
      
      if (result.success) {
        // 該当ユーザーに設定変更を通知
        this.socket.to(userId).emit('userSettingsUpdated', {
          userId: userId,
          settings: settings,
          updatedBy: this.socket.username,
          timestamp: new Date()
        });
      }
      
      return result;
    }, callback);
  }

  /**
   * ユーザータイプ更新ハンドラー
   */
  private async handleUpdateUserType(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { userId, type } = data;
      
      if (!userId) {
        throw new Error('User ID is required');
      }

      if (!type) {
        throw new Error('User type is required');
      }

      const result = await this.userOp.updateUserType(userId, type);
      
      if (result.success) {
        // 全クライアントにユーザータイプ変更を通知
        this.socket.broadcast.emit('userTypeChanged', {
          userId: userId,
          type: type,
          user: result.data,
          updatedBy: this.socket.username,
          timestamp: new Date()
        });
      }
      
      return result;
    }, callback);
  }

  /**
   * ユーザー統計取得ハンドラー
   */
  private async handleGetUserStatistics(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      return await this.userOp.getUserStatistics();
    }, callback);
  }

  /**
   * ユーザー一覧取得ハンドラー
   */
  private async handleGetUsers(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { limit = 50, skip = 0, sort = { createdAt: -1 } } = data;
      
      return await this.userOp.findMany({}, { limit, skip, sort });
    }, callback);
  }

  /**
   * 認証IDでユーザー取得ハンドラー
   */
  private async handleGetUserByAuthId(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { authId } = data;
      
      if (!authId) {
        throw new Error('Auth ID is required');
      }

      return await this.userOp.findByAuthId(authId);
    }, callback);
  }

  /**
   * メールアドレスでユーザー検索ハンドラー
   */
  private async handleGetUserByEmail(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { email, limit = 50, skip = 0 } = data;
      
      if (!email) {
        throw new Error('Email is required');
      }

      return await this.userOp.findByEmail(email, { limit, skip });
    }, callback);
  }

  /**
   * ユーザーがオンラインになった時の処理
   */
  public async handleUserOnline(userId: string): Promise<void> {
    try {
      this.logger.info('User came online', { userId });
      
      const result = await this.userOp.updateOnlineStatus(userId, true);
      
      if (result.success) {
        // 全クライアントにオンライン状態を通知
        this.socket.broadcast.emit('userCameOnline', {
          userId: userId,
          user: result.data,
          timestamp: new Date()
        });
      }
    } catch (error) {
      this.logger.error('Error handling user online', error, { userId });
    }
  }

  /**
   * ユーザーがオフラインになった時の処理
   */
  public async handleUserOffline(userId: string): Promise<void> {
    try {
      this.logger.info('User went offline', { userId });
      
      const result = await this.userOp.updateOnlineStatus(userId, false);
      
      if (result.success) {
        // 全クライアントにオフライン状態を通知
        this.socket.broadcast.emit('userWentOffline', {
          userId: userId,
          user: result.data,
          timestamp: new Date()
        });
      }
    } catch (error) {
      this.logger.error('Error handling user offline', error, { userId });
    }
  }

  /**
   * ユーザーの最終アクセス時刻を更新
   */
  public async updateUserLastSeen(userId: string): Promise<void> {
    try {
      await this.userOp.updateLastSeen(userId);
    } catch (error) {
      this.logger.error('Error updating user last seen', error, { userId });
    }
  }

  /**
   * ユーザーがルームに参加した時の処理
   */
  public async handleUserJoinedRoom(userId: string, roomName: string): Promise<void> {
    try {
      this.logger.info('User joined room', { userId, roomName });
      
      // 最終アクセス時刻を更新
      await this.updateUserLastSeen(userId);
      
      // ルーム内の他のユーザーに通知
      this.socket.to(roomName).emit('userJoinedRoom', {
        userId: userId,
        room: roomName,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Error handling user joined room', error, { userId, roomName });
    }
  }

  /**
   * ユーザーがルームから退出した時の処理
   */
  public async handleUserLeftRoom(userId: string, roomName: string): Promise<void> {
    try {
      this.logger.info('User left room', { userId, roomName });
      
      // ルーム内の他のユーザーに通知
      this.socket.to(roomName).emit('userLeftRoom', {
        userId: userId,
        room: roomName,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Error handling user left room', error, { userId, roomName });
    }
  }

  /**
   * ユーザー情報をブロードキャスト
   */
  public broadcastUserInfo(userId: string, event: string, data: any): void {
    try {
      this.socket.broadcast.emit(event, {
        userId: userId,
        ...data,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Error broadcasting user info', error, { userId, event });
    }
  }

  /**
   * 特定のユーザーにメッセージを送信
   */
  public sendToUser(userId: string, event: string, data: any): void {
    try {
      this.socket.to(userId).emit(event, {
        ...data,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Error sending message to user', error, { userId, event });
    }
  }

  /**
   * イベントデータのバリデーション
   */
  protected async validateEventData(eventName: string, data: any): Promise<{
    isValid: boolean;
    errors: any[];
  }> {
    const errors: any[] = [];

    // イベント別の詳細バリデーション
    switch (eventName) {
      case 'getUserInfo':
      case 'deleteUser':
      case 'updateUser':
      case 'updateOnlineStatus':
      case 'updateUserSettings':
      case 'updateUserType':
        if (!data.userId) {
          errors.push({ field: 'userId', message: 'User ID is required' });
        }
        break;
        
      case 'createUser':
        if (!data.authId) {
          errors.push({ field: 'authId', message: 'Auth ID is required' });
        }
        if (!data.displayName) {
          errors.push({ field: 'displayName', message: 'Display name is required' });
        }
        break;
        
      case 'searchUsers':
        if (!data.keyword || data.keyword.trim().length < 2) {
          errors.push({ field: 'keyword', message: 'Search keyword must be at least 2 characters' });
        }
        break;
        
      case 'getUsersByType':
        if (!data.type) {
          errors.push({ field: 'type', message: 'User type is required' });
        }
        break;
        
      case 'getUserByAuthId':
        if (!data.authId) {
          errors.push({ field: 'authId', message: 'Auth ID is required' });
        }
        break;
        
      case 'getUserByEmail':
        if (!data.email) {
          errors.push({ field: 'email', message: 'Email is required' });
        }
        break;
        
      case 'updateOnlineStatus':
        if (typeof data.isOnline !== 'boolean') {
          errors.push({ field: 'isOnline', message: 'isOnline must be a boolean value' });
        }
        break;
        
      case 'updateUserSettings':
        if (!data.settings || typeof data.settings !== 'object') {
          errors.push({ field: 'settings', message: 'Settings must be a valid object' });
        }
        break;
        
      case 'updateUserType':
        if (!data.type) {
          errors.push({ field: 'type', message: 'User type is required' });
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default UserReceiver;
