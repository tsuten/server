import { Server } from 'socket.io';
import { CustomSocket } from '../types/socket.js';
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
import { userOperation } from '../operations/userOperation.js';
import { channelOperation } from '../operations/channelOperation.js';
import authOperation from '../operations/authOperation.js';
import { joinUserToChannel, leaveUserFromChannel } from '../socket/joinChannelRooms.js';

/**
 * MessageReceiver クラス
 * メッセージ関連のSocket.IOイベントを処理
 */
export class MessageReceiver extends BaseReceiver<MessageEntity, MessageCreateData, MessageUpdateData> {
  protected operation: MessageOperationInterface;
  protected logger = createLogger(LogCategory.RECEIVER, 'MessageReceiver');
  protected declare socket: CustomSocket; // 型を明示的に指定
  
  constructor(io: Server, socket: CustomSocket, options: ReceiverOptions = {}) {
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
    
    // チャンネル参加イベント
    this.addEventHandler('joinChannel', this.handleJoinChannel.bind(this));
    
    // チャンネル退出イベント
    this.addEventHandler('leaveChannel', this.handleLeaveChannel.bind(this));
    
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
    
    // 認証されたユーザー情報を使用してデータを補完
    if (!this.socket.user) {
      const errorResponse = this.createErrorResponse('User not authenticated');
      this.logger.warn('Unauthenticated user tried to send message', { socketId: this.socket.id });
      this.socket.emit('messageError', errorResponse);
      if (callback) callback(errorResponse);
      return;
    }

    await this.safeExecute(async () => {
      this.logger.info('Starting message creation');
      
      const senderId = String(this.socket.user!._id);
      const channelId = data.channelId;

      // senderIdの存在確認
      const senderExists = await this.validateSenderExists(senderId);
      if (!senderExists.isValid) {
        return this.createErrorResult(senderExists.error || 'Sender validation failed');
      }

      // channelIdの存在確認
      if (!channelId) {
        return this.createErrorResult('Channel ID is required');
      }

      const channelExists = await this.validateChannelExists(channelId);
      if (!channelExists.isValid) {
        return this.createErrorResult(channelExists.error || 'Channel validation failed');
      }
      
      const messageData = {
        ...data,
        senderId: senderId // 認証されたユーザーIDを文字列として使用
      };
      
      this.logger.debug('Message data with senderId merged', messageData);
      
      // メッセージを作成
      const result = await this.operation.create(messageData);
      
      this.logger.debug('Operation create result', result);
      
      if (result.success && result.data) {
        this.logger.info('Message created successfully', { 
          messageId: result.data._id, 
          channelId: result.data.channelId 
        });
        
        // MessageSenderが非同期で通知を送信するため、ここでは即座の送信は行わない
        this.logger.debug('Message creation completed, MessageSender will handle notifications', {
          messageId: result.data._id,
          channelId: result.data.channelId
        });
        
        // 送信者にのみ確認レスポンスを送信（これは重複しない）
        this.logger.debug('Sending confirmation to message sender', { 
          senderId: result.data.senderId,
          socketId: this.socket.id 
        });
        
        this.emitToClient('messageSent', result.data);
        
        this.logger.debug('messageSent confirmation sent to sender');
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
    const { channelId, limit = 50, skip = 0 } = data;
    
    await this.safeExecute(async () => {
      if (channelId) {
        // channelIdが指定されている場合は存在確認
        const channelExists = await this.validateChannelExists(channelId);
        if (!channelExists.isValid) {
          return this.createErrorResult(channelExists.error || 'Channel not found');
        }
        
        return await this.operation.findByChannel(channelId, { limit, skip });
      } else {
        return await this.operation.getLatest(limit);
      }
    }, callback);
  }

  /**
   * チャンネル参加ハンドラー
   */
  private async handleJoinChannel(data: any, callback?: (response: any) => void): Promise<void> {
    const { channelId } = data;
    
    if (!channelId) {
      const errorResponse = this.createErrorResponse('Channel ID is required');
      if (callback) callback(errorResponse);
      return;
    }

    try {
      // チャンネルの存在確認
      const channelExists = await this.validateChannelExists(channelId);
      if (!channelExists.isValid) {
        const errorResponse = this.createErrorResponse(channelExists.error || 'Channel not found');
        if (callback) callback(errorResponse);
        return;
      }

      // チャンネルに参加
      this.logger.info('User joining channel', { 
        userId: this.socket.user?._id, 
        channelId, 
        socketId: this.socket.id 
      });
      
      // 新しいjoinChannelRoomsの機能を使用
      const joinSuccess = await joinUserToChannel(this.socket, channelId);
      if (!joinSuccess) {
        const errorResponse = this.createErrorResponse('Failed to join channel or access denied');
        if (callback) callback(errorResponse);
        return;
      }
      
      this.logger.debug('User joined channel successfully', { 
        channelId, 
        socketRooms: Array.from(this.socket.rooms) 
      });
      
      // システムメッセージを作成（システムアカウントのIDが必要）
      await this.safeExecute(async () => {
        return await this.operation.create({
          message: `User joined the channel`,
          senderId: 'system', // システムアカウントのID（文字列）
          channelId: channelId,
          type: 'system' as MessageType
        });
      });

      // チャンネルの他のメンバーに通知（channel:プレフィックス付きルーム名を使用）
      const channelRoomName = `channel:${channelId}`;
      this.socket.to(channelRoomName).emit('userJoined', {
        userId: this.socket.user?._id,
        channelId,
        timestamp: new Date()
      });

      // 成功レスポンス
      const successResponse = this.createSuccessResponse({ 
        channelId,
        userId: this.socket.user?._id 
      }, 'Successfully joined channel');
      if (callback) callback(successResponse);

    } catch (error) {
      const errorResponse = this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to join channel'
      );
      if (callback) callback(errorResponse);
    }
  }

  /**
   * チャンネル退出ハンドラー
   */
  private async handleLeaveChannel(data: any, callback?: (response: any) => void): Promise<void> {
    const { channelId } = data;
    
    if (!channelId) {
      const errorResponse = this.createErrorResponse('Channel ID is required');
      if (callback) callback(errorResponse);
      return;
    }

    try {
      // チャンネルの存在確認
      const channelExists = await this.validateChannelExists(channelId);
      if (!channelExists.isValid) {
        const errorResponse = this.createErrorResponse(channelExists.error || 'Channel not found');
        if (callback) callback(errorResponse);
        return;
      }

      // チャンネルから退出
      leaveUserFromChannel(this.socket, channelId);
      
      // システムメッセージを作成
      await this.safeExecute(async () => {
        return await this.operation.create({
          message: `User left the channel`,
          senderId: 'system', // システムアカウントのID（文字列）
          channelId: channelId,
          type: 'system' as MessageType
        });
      });

      // チャンネルの他のメンバーに通知（channel:プレフィックス付きルーム名を使用）
      const channelRoomName = `channel:${channelId}`;
      this.socket.to(channelRoomName).emit('userLeft', {
        userId: this.socket.user?._id,
        channelId,
        timestamp: new Date()
      });

      // 成功レスポンス
      const successResponse = this.createSuccessResponse({ 
        channelId,
        userId: this.socket.user?._id 
      }, 'Successfully left channel');
      if (callback) callback(successResponse);

    } catch (error) {
      const errorResponse = this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to leave channel'
      );
      if (callback) callback(errorResponse);
    }
  }

  /**
   * メッセージ検索ハンドラー
   */
  private async handleSearchMessages(data: any, callback?: (response: any) => void): Promise<void> {
    const { keyword, channelId, limit = 50 } = data;
    
    await this.safeExecute(async () => {
      // channelIdが指定されている場合は存在確認
      if (channelId) {
        const channelExists = await this.validateChannelExists(channelId);
        if (!channelExists.isValid) {
          return this.createErrorResult(channelExists.error || 'Channel not found');
        }
      }

      return await this.operation.search(keyword, channelId, limit);
    }, callback);
  }

  /**
   * メッセージ履歴取得ハンドラー
   */
  private async handleGetMessageHistory(data: any, callback?: (response: any) => void): Promise<void> {
    const { startDate, endDate, channelId } = data;
    
    await this.safeExecute(async () => {
      // channelIdが指定されている場合は存在確認
      if (channelId) {
        const channelExists = await this.validateChannelExists(channelId);
        if (!channelExists.isValid) {
          return this.createErrorResult(channelExists.error || 'Channel not found');
        }
      }

      if (startDate && endDate) {
        return await this.operation.findByDateRange({
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          channelId
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
    const senderId = this.socket.user?._id;
    if (senderId) {
      const rateLimit = messageSchema.checkRateLimit(senderId, eventName);
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
        
      case 'joinChannel':
      case 'leaveChannel':
        return this.validateChannelActionData(data);
        
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
    // 認証されたユーザーIDを文字列として使用
    const validationData = {
      ...data,
      senderId: String(this.socket.user?._id || '')
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

    if (data.channelId !== undefined && typeof data.channelId !== 'string') {
      errors.push({ 
        field: 'channelId', 
        message: 'Channel ID must be a string' 
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * チャンネル参加/退出イベントのバリデーション
   */
  private validateChannelActionData(data: any): { isValid: boolean; errors: any[] } {
    const errors: any[] = [];

    if (!data.channelId || typeof data.channelId !== 'string') {
      errors.push({ field: 'channelId', message: 'Channel ID is required' });
    }

    // Socket接続時に認証されたユーザー情報を使用
    const userId = this.socket.user?._id;
    if (!userId) {
      errors.push({ field: 'userId', message: 'User authentication required' });
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

    if (data.channelId !== undefined && typeof data.channelId !== 'string') {
      errors.push({ 
        field: 'channelId', 
        message: 'Channel ID must be a string' 
      });
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

    if (data.channelId !== undefined && typeof data.channelId !== 'string') {
      errors.push({ 
        field: 'channelId', 
        message: 'Channel ID must be a string' 
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 送信者（ユーザー）の存在確認
   */
  private async validateSenderExists(senderId: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      const userResult = await authOperation.findById(senderId);
      
      if (!userResult.success || !userResult.data) {
        this.logger.warn('Sender not found', { senderId });
        return {
          isValid: false,
          error: `Sender with ID ${senderId} not found`
        };
      }

      this.logger.debug('Sender validation successful', {
        senderId,
        username: userResult.data.username
      });

      return { isValid: true };
    } catch (error) {
      this.logger.error('Error validating sender', error, { senderId });
      return {
        isValid: false,
        error: 'Failed to validate sender'
      };
    }
  }

  /**
   * チャンネルの存在確認
   */
  private async validateChannelExists(channelId: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      const channelResult = await channelOperation.findById(channelId);
      
      if (!channelResult.success || !channelResult.data) {
        this.logger.warn('Channel not found', { channelId });
        return {
          isValid: false,
          error: `Channel with ID ${channelId} not found`
        };
      }

      this.logger.debug('Channel validation successful', {
        channelId,
        channelName: channelResult.data.name
      });

      return { isValid: true };
    } catch (error) {
      this.logger.error('Error validating channel', error, { channelId });
      return {
        isValid: false,
        error: 'Failed to validate channel'
      };
    }
  }

  /**
   * エラー結果を作成するヘルパーメソッド
   */
  private createErrorResult(error: string) {
    return {
      success: false,
      error
    };
  }
}

export default MessageReceiver;