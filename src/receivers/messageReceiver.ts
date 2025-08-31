import { Server, Socket } from 'socket.io';
import { BaseReceiver, ReceiverOptions } from '../base/BaseReceiver.js';
import { messageOperation } from '../operations/MessageOperation.js';
import { messageSchema } from '../schemas/MessageSchema.js';
import { createLogger, LogCategory } from '../utils/consoleLog.js';
import {
  MessageEntity,
  MessageCreateData,
  MessageUpdateData,
  MessageOperationInterface,
  MessageType
} from '../types/message.js';

/**
 * MessageReceiver クラス
 * メッセージ関連のSocket.IOイベントを処理
 */
export class MessageReceiver extends BaseReceiver<MessageEntity, MessageCreateData, MessageUpdateData> {
  protected operation: MessageOperationInterface;
  protected logger = createLogger(LogCategory.RECEIVER, 'MessageReceiver');
  
  constructor(io: Server, socket: Socket, options: ReceiverOptions = {}) {
    super(io, socket, messageOperation, options);
    this.operation = messageOperation;
  }

  /**
   * カスタムイベントハンドラーを設定
   */
  protected setupEventHandlers(): void {
    // メッセージ送信イベント
    this.addEventHandler('sendMessage', this.handleSendMessage.bind(this));
    
    // メッセージ取得イベント
    this.addEventHandler('getMessages', this.handleGetMessages.bind(this));
    
    // ルーム参加イベント
    this.addEventHandler('joinRoom', this.handleJoinRoom.bind(this));
    
    // ルーム退出イベント
    this.addEventHandler('leaveRoom', this.handleLeaveRoom.bind(this));
    
    // メッセージ検索イベント
    this.addEventHandler('searchMessages', this.handleSearchMessages.bind(this));
    
    // メッセージ履歴取得イベント
    this.addEventHandler('getMessageHistory', this.handleGetMessageHistory.bind(this));
  }

  /**
   * メッセージ送信ハンドラー
   */
  private async handleSendMessage(data: any, callback?: (response: any) => void): Promise<void> {
    this.logger.debug('handleSendMessage called', data);
    
    await this.safeExecute(async () => {
      this.logger.info('Starting message creation');
      
      // Socket接続時のusernameを使用してデータを補完
      const messageData = {
        ...data,
        username: data.username || this.socket.handshake.query.username
      };
      
      this.logger.debug('Message data with username merged', messageData);
      
      // メッセージを作成
      const result = await this.operation.create(messageData);
      
      this.logger.debug('Operation create result', result);
      
      if (result.success && result.data) {
        this.logger.info('Message created successfully, broadcasting', { 
          messageId: result.data._id, 
          room: result.data.room 
        });
        
        // 成功時は該当ルームの全クライアントにブロードキャスト
        const room = result.data.room || 'general';
        this.emitToRoom(room, 'newMessage', result.data);
        
        // 送信者にも確認レスポンスを送信
        this.emitToClient('messageSent', result.data);
      } else {
        this.logger.warn('Message creation failed', result.error);
      }
      
      return result;
    }, callback);
  }

  /**
   * メッセージ取得ハンドラー
   */
  private async handleGetMessages(data: any, callback?: (response: any) => void): Promise<void> {
    const { room, limit = 50, skip = 0 } = data;
    
    await this.safeExecute(async () => {
      if (room) {
        return await this.operation.findByRoom(room, { limit, skip });
      } else {
        return await this.operation.getLatest(limit);
      }
    }, callback);
  }

  /**
   * ルーム参加ハンドラー
   */
  private async handleJoinRoom(data: any, callback?: (response: any) => void): Promise<void> {
    const { room, username } = data;
    
    if (!room || !username) {
      const errorResponse = this.createErrorResponse('Room and username are required');
      if (callback) callback(errorResponse);
      return;
    }

    try {
      // ルームに参加
      this.joinRoom(room);
      
      // システムメッセージを作成
      await this.safeExecute(async () => {
        return await this.operation.create({
          message: `${username} joined the room`,
          username: 'system',
          room: room,
          type: 'system' as MessageType
        });
      });

      // ルームの他のメンバーに通知
      this.socket.to(room).emit('userJoined', {
        username,
        room,
        timestamp: new Date()
      });

      // 成功レスポンス
      const successResponse = this.createSuccessResponse({ room, username }, 'Successfully joined room');
      if (callback) callback(successResponse);

    } catch (error) {
      const errorResponse = this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to join room'
      );
      if (callback) callback(errorResponse);
    }
  }

  /**
   * ルーム退出ハンドラー
   */
  private async handleLeaveRoom(data: any, callback?: (response: any) => void): Promise<void> {
    const { room, username } = data;
    
    if (!room || !username) {
      const errorResponse = this.createErrorResponse('Room and username are required');
      if (callback) callback(errorResponse);
      return;
    }

    try {
      // ルームから退出
      this.leaveRoom(room);
      
      // システムメッセージを作成
      await this.safeExecute(async () => {
        return await this.operation.create({
          message: `${username} left the room`,
          username: 'system',
          room: room,
          type: 'system' as MessageType
        });
      });

      // ルームの他のメンバーに通知
      this.socket.to(room).emit('userLeft', {
        username,
        room,
        timestamp: new Date()
      });

      // 成功レスポンス
      const successResponse = this.createSuccessResponse({ room, username }, 'Successfully left room');
      if (callback) callback(successResponse);

    } catch (error) {
      const errorResponse = this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to leave room'
      );
      if (callback) callback(errorResponse);
    }
  }

  /**
   * メッセージ検索ハンドラー
   */
  private async handleSearchMessages(data: any, callback?: (response: any) => void): Promise<void> {
    const { keyword, room, limit = 50 } = data;
    
    await this.safeExecute(async () => {
      return await this.operation.search(keyword, room, limit);
    }, callback);
  }

  /**
   * メッセージ履歴取得ハンドラー
   */
  private async handleGetMessageHistory(data: any, callback?: (response: any) => void): Promise<void> {
    const { startDate, endDate, room } = data;
    
    await this.safeExecute(async () => {
      if (startDate && endDate) {
        return await this.operation.findByDateRange({
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          room
        });
      } else {
        return await this.operation.getLatest(50);
      }
    }, callback);
  }

  /**
   * イベントデータのバリデーション
   */
  protected async validateEventData(eventName: string, data: any): Promise<{
    isValid: boolean;
    errors: any[];
  }> {
    // レート制限チェック
    const username = data.username || this.socket.handshake.query.username;
    if (username) {
      const rateLimit = messageSchema.checkRateLimit(username as string, eventName);
      if (!rateLimit.allowed) {
        return {
          isValid: false,
          errors: [{ field: 'rateLimit', message: rateLimit.message || 'レート制限に達しました' }]
        };
      }
    }

    // イベント別の詳細バリデーション
    switch (eventName) {
      case 'sendMessage':
        return this.validateSendMessageData(data);
        
      case 'getMessages':
        return this.validateGetMessagesData(data);
        
      case 'joinRoom':
      case 'leaveRoom':
        return this.validateRoomActionData(data);
        
      case 'searchMessages':
        return this.validateSearchData(data);
        
      case 'getMessageHistory':
        return this.validateHistoryData(data);
        
      default:
        return { isValid: true, errors: [] };
    }
  }

  /**
   * sendMessageイベントのバリデーション
   */
  private validateSendMessageData(data: any): { isValid: boolean; errors: any[] } {
    // Socket接続時のusernameを使用
    const validationData = {
      ...data,
      username: data.username || this.socket.handshake.query.username
    };

    const result = messageSchema.validate(validationData);
    
    return {
      isValid: result.isValid,
      errors: result.errors || []
    };
  }

  /**
   * getMessagesイベントのバリデーション
   */
  private validateGetMessagesData(data: any): { isValid: boolean; errors: any[] } {
    const errors: any[] = [];

    if (data.limit !== undefined) {
      if (typeof data.limit !== 'number' || data.limit < 1 || data.limit > 100) {
        errors.push({ field: 'limit', message: 'Limit must be a number between 1 and 100' });
      }
    }

    if (data.skip !== undefined) {
      if (typeof data.skip !== 'number' || data.skip < 0) {
        errors.push({ field: 'skip', message: 'Skip must be a non-negative number' });
      }
    }

    if (data.room !== undefined) {
      const allowedRooms = messageSchema.getAllowedRooms();
      if (typeof data.room !== 'string' || !allowedRooms.includes(data.room)) {
        errors.push({ 
          field: 'room', 
          message: `Invalid room. Allowed rooms: ${allowedRooms.join(', ')}` 
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * ルーム参加/退出イベントのバリデーション
   */
  private validateRoomActionData(data: any): { isValid: boolean; errors: any[] } {
    const errors: any[] = [];

    if (!data.room || typeof data.room !== 'string') {
      errors.push({ field: 'room', message: 'Room name is required' });
    } else {
      const allowedRooms = messageSchema.getAllowedRooms();
      if (!allowedRooms.includes(data.room)) {
        errors.push({ 
          field: 'room', 
          message: `Invalid room. Allowed rooms: ${allowedRooms.join(', ')}` 
        });
      }
    }

    const username = data.username || this.socket.handshake.query.username;
    if (!username || typeof username !== 'string') {
      errors.push({ field: 'username', message: 'Username is required' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 検索イベントのバリデーション
   */
  private validateSearchData(data: any): { isValid: boolean; errors: any[] } {
    const errors: any[] = [];

    if (!data.keyword || typeof data.keyword !== 'string' || data.keyword.trim().length < 2) {
      errors.push({ field: 'keyword', message: 'Search keyword must be at least 2 characters' });
    }

    if (data.keyword && data.keyword.length > 100) {
      errors.push({ field: 'keyword', message: 'Search keyword must be at most 100 characters' });
    }

    if (data.room !== undefined) {
      const allowedRooms = messageSchema.getAllowedRooms();
      if (typeof data.room !== 'string' || !allowedRooms.includes(data.room)) {
        errors.push({ 
          field: 'room', 
          message: `Invalid room. Allowed rooms: ${allowedRooms.join(', ')}` 
        });
      }
    }

    if (data.limit !== undefined) {
      if (typeof data.limit !== 'number' || data.limit < 1 || data.limit > 50) {
        errors.push({ field: 'limit', message: 'Limit must be a number between 1 and 50' });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 履歴取得イベントのバリデーション
   */
  private validateHistoryData(data: any): { isValid: boolean; errors: any[] } {
    const errors: any[] = [];

    if (data.startDate !== undefined) {
      const startDate = new Date(data.startDate);
      if (isNaN(startDate.getTime())) {
        errors.push({ field: 'startDate', message: 'Invalid start date format' });
      }
    }

    if (data.endDate !== undefined) {
      const endDate = new Date(data.endDate);
      if (isNaN(endDate.getTime())) {
        errors.push({ field: 'endDate', message: 'Invalid end date format' });
      }
    }

    if (data.startDate && data.endDate) {
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      if (startDate >= endDate) {
        errors.push({ field: 'dateRange', message: 'Start date must be before end date' });
      }
    }

    if (data.room !== undefined) {
      const allowedRooms = messageSchema.getAllowedRooms();
      if (typeof data.room !== 'string' || !allowedRooms.includes(data.room)) {
        errors.push({ 
          field: 'room', 
          message: `Invalid room. Allowed rooms: ${allowedRooms.join(', ')}` 
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default MessageReceiver;