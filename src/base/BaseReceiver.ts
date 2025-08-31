import { Server, Socket } from 'socket.io';
import { BaseOperationInterface } from '../types/operation.js';
import { BaseEntity, OperationResult } from '../types/base.js';
import { createLogger, LogCategory } from '../utils/consoleLog.js';

/**
 * Socket.IOイベントハンドラーの型定義
 */
export type SocketEventHandler = (data: any, callback?: (response: any) => void) => Promise<void> | void;

/**
 * レシーバーの設定オプション
 */
export interface ReceiverOptions {
  enableLogging?: boolean;
  enableErrorHandling?: boolean;
  enableValidation?: boolean;
  maxRetries?: number;
}

/**
 * BaseReceiver抽象クラス
 * Socket.IOを使用したリアルタイム通信の基盤クラス
 */
export abstract class BaseReceiver<T extends BaseEntity, CreateData, UpdateData> {
  protected io: Server;
  protected socket: Socket;
  protected operation: BaseOperationInterface<T, CreateData, UpdateData>;
  protected options: ReceiverOptions;
  protected eventHandlers: Map<string, SocketEventHandler> = new Map();
  protected logger = createLogger(LogCategory.RECEIVER, 'BaseReceiver');

  constructor(
    io: Server,
    socket: Socket,
    operation: BaseOperationInterface<T, CreateData, UpdateData>,
    options: ReceiverOptions = {}
  ) {
    this.io = io;
    this.socket = socket;
    this.operation = operation;
    this.options = {
      enableLogging: true,
      enableErrorHandling: true,
      enableValidation: true,
      maxRetries: 3,
      ...options
    };

    // 基本的なイベントハンドラーを設定
    this.setupBaseEventHandlers();
    
    // 子クラスでカスタムイベントハンドラーを設定
    this.setupEventHandlers();
    
    // イベントリスナーを登録
    this.registerEventListeners();
  }

  /**
   * 基本的なイベントハンドラーを設定
   */
  private setupBaseEventHandlers(): void {
    // 接続イベント
    this.addEventHandler('connect', this.handleConnect.bind(this));
    
    // 切断イベント
    this.addEventHandler('disconnect', this.handleDisconnect.bind(this));
    
    // エラーイベント
    this.addEventHandler('error', this.handleError.bind(this));
  }

  /**
   * カスタムイベントハンドラーを設定（子クラスでオーバーライド）
   */
  protected abstract setupEventHandlers(): void;

  /**
   * イベントハンドラーを追加
   */
  protected addEventHandler(eventName: string, handler: SocketEventHandler): void {
    this.eventHandlers.set(eventName, handler);
  }

  /**
   * イベントリスナーを登録
   */
  private registerEventListeners(): void {
    this.eventHandlers.forEach((handler, eventName) => {
      this.socket.on(eventName, async (data: any, callback?: (response: any) => void) => {
        try {
          if (this.options.enableLogging) {
            this.logger.debug(`Event received: ${eventName}`, { eventName, data });
          }

          // バリデーション
          if (this.options.enableValidation && eventName !== 'connect' && eventName !== 'disconnect') {
            const validationResult = await this.validateEventData(eventName, data);
            if (!validationResult.isValid) {
              const errorResponse = this.createErrorResponse('Validation failed', validationResult.errors);
              
              // コールバックでレスポンス
              if (callback) callback(errorResponse);
              
              // systemイベントでもエラー通知を送信
              this.emitSystemError(eventName, errorResponse);
              
              return;
            }
          }

          // ハンドラーを実行
          await handler(data, callback);

        } catch (error) {
          if (this.options.enableErrorHandling) {
            await this.handleEventError(eventName, error, callback);
          } else {
            throw error;
          }
        }
      });
    });
  }

  /**
   * 接続イベントハンドラー
   */
  protected async handleConnect(): Promise<void> {
    if (this.options.enableLogging) {
      this.logger.info('Client connected', { socketId: this.socket.id });
    }
  }

  /**
   * 切断イベントハンドラー
   */
  protected async handleDisconnect(reason: string): Promise<void> {
    if (this.options.enableLogging) {
      this.logger.info('Client disconnected', { socketId: this.socket.id, reason });
    }
  }

  /**
   * エラーイベントハンドラー
   */
  protected async handleError(error: any): Promise<void> {
    this.logger.error('Socket error', error, { socketId: this.socket.id });
  }

  /**
   * イベントエラーハンドラー
   */
  protected async handleEventError(
    eventName: string,
    error: any,
    callback?: (response: any) => void
  ): Promise<void> {
    this.logger.error(`Error handling event ${eventName}`, error, { eventName });
    
    const errorResponse = this.createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error occurred',
      []
    );
    
    // コールバックでレスポンス
    if (callback) {
      callback(errorResponse);
    }
    
    // systemイベントでもエラー通知を送信
    const systemErrorData = {
      type: 'system_error',
      originalEvent: eventName,
      timestamp: new Date(),
      error: errorResponse.error,
      message: `${eventName}イベントでシステムエラーが発生しました`
    };
    
    this.emitToClient('system', systemErrorData);
  }

  /**
   * イベントデータのバリデーション（子クラスでオーバーライド可能）
   */
  protected async validateEventData(eventName: string, data: any): Promise<{
    isValid: boolean;
    errors: any[];
  }> {
    // デフォルトは常に有効
    return { isValid: true, errors: [] };
  }

  /**
   * 成功レスポンスを作成
   */
  protected createSuccessResponse<R>(data: R, message?: string): {
    success: true;
    data: R;
    message?: string;
  } {
    return {
      success: true,
      data,
      ...(message && { message })
    };
  }

  /**
   * エラーレスポンスを作成
   */
  protected createErrorResponse(error: string, errors: any[] = []): {
    success: false;
    error: string;
    errors?: any[];
  } {
    return {
      success: false,
      error,
      ...(errors.length > 0 && { errors })
    };
  }

  /**
   * 特定のクライアントにメッセージを送信
   */
  protected emitToClient(eventName: string, data: any): void {
    this.socket.emit(eventName, data);
  }

  /**
   * 全クライアントにメッセージをブロードキャスト
   */
  protected broadcast(eventName: string, data: any): void {
    this.io.emit(eventName, data);
  }

  /**
   * 特定のルームにメッセージを送信
   */
  protected emitToRoom(room: string, eventName: string, data: any): void {
    this.io.to(room).emit(eventName, data);
  }

  /**
   * システムエラーをクライアントに通知
   */
  protected emitSystemError(originalEvent: string, errorResponse: any): void {
    const systemErrorData = {
      type: 'validation_error',
      originalEvent: originalEvent,
      timestamp: new Date(),
      error: errorResponse.error,
      errors: errorResponse.errors,
      message: `${originalEvent}イベントでバリデーションエラーが発生しました`
    };

    // systemイベントで通知
    this.emitToClient('system', systemErrorData);
    
    if (this.options.enableLogging) {
      this.logger.debug('System error sent to client', { socketId: this.socket.id, systemErrorData });
    }
  }

  /**
   * クライアントをルームに参加させる
   */
  protected joinRoom(room: string): void {
    this.socket.join(room);
    if (this.options.enableLogging) {
      this.logger.info('Client joined room', { socketId: this.socket.id, room });
    }
  }

  /**
   * クライアントをルームから退出させる
   */
  protected leaveRoom(room: string): void {
    this.socket.leave(room);
    if (this.options.enableLogging) {
      this.logger.info('Client left room', { socketId: this.socket.id, room });
    }
  }

  /**
   * OperationResultをSocket.IOレスポンスに変換
   */
  protected convertOperationResult<R>(result: OperationResult<R>): any {
    if (result.success) {
      return this.createSuccessResponse(result.data);
    } else {
      return this.createErrorResponse(
        result.error || 'Operation failed',
        result.errors || []
      );
    }
  }

  /**
   * 非同期操作を安全に実行
   */
  protected async safeExecute<R>(
    operation: () => Promise<OperationResult<R>>,
    callback?: (response: any) => void
  ): Promise<void> {
    try {
      const result = await operation();
      const response = this.convertOperationResult(result);
      
      if (callback) {
        callback(response);
      }
    } catch (error) {
      const errorResponse = this.createErrorResponse(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
      
      if (callback) {
        callback(errorResponse);
      }
    }
  }

  /**
   * リソースのクリーンアップ
   */
  public cleanup(): void {
    // イベントリスナーを削除
    this.eventHandlers.forEach((_, eventName) => {
      this.socket.removeAllListeners(eventName);
    });
    
    this.eventHandlers.clear();
    
    if (this.options.enableLogging) {
      this.logger.info('Cleaned up resources', { socketId: this.socket.id });
    }
  }
}

export default BaseReceiver;
