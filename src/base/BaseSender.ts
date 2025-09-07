import { Server } from 'socket.io';
import { createLogger, LogCategory } from '../utils/consoleLog.js';
import { SendJob, SendResult, SenderOptions, SendPriority } from '../types/sender.js';

/**
 * BaseSender クラス
 * 各ドメインのSenderクラスの基底クラス
 */
export abstract class BaseSender {
  protected io: Server;
  protected logger = createLogger(LogCategory.SENDER, this.constructor.name);
  protected options: Required<SenderOptions>;
  
  // キューとリトライ管理
  private sendQueue: SendJob[] = [];
  private processing = false;
  private jobIdCounter = 0;

  constructor(io: Server, options: SenderOptions = {}) {
    this.io = io;
    this.options = {
      maxAttempts: options.maxAttempts ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      queueProcessInterval: options.queueProcessInterval ?? 100,
      maxConcurrentSends: options.maxConcurrentSends ?? 10,
      enableQueue: options.enableQueue ?? true,
      enableBatching: options.enableBatching ?? false,
      batchSize: options.batchSize ?? 50,
      batchTimeout: options.batchTimeout ?? 1000
    };

    // キュー処理を開始
    if (this.options.enableQueue) {
      this.startQueueProcessor();
    }
  }

  /**
   * 単一ユーザーに送信
   */
  protected async sendToUser(userId: string, event: string, data: any, priority: SendPriority = SendPriority.NORMAL): Promise<SendResult> {
    return this.enqueueSend({
      type: 'user',
      targets: [userId],
      event,
      data,
      priority
    });
  }

  /**
   * ルームに送信
   */
  protected async sendToRoom(roomId: string, event: string, data: any, priority: SendPriority = SendPriority.NORMAL): Promise<SendResult> {
    return this.enqueueSend({
      type: 'room',
      targets: [roomId],
      event,
      data,
      priority
    });
  }

  /**
   * 全体にブロードキャスト
   */
  protected async broadcast(event: string, data: any, priority: SendPriority = SendPriority.NORMAL): Promise<SendResult> {
    return this.enqueueSend({
      type: 'broadcast',
      targets: [],
      event,
      data,
      priority
    });
  }

  /**
   * 複数ユーザーに送信
   */
  protected async sendToUsers(userIds: string[], event: string, data: any, priority: SendPriority = SendPriority.NORMAL): Promise<SendResult> {
    return this.enqueueSend({
      type: 'users',
      targets: userIds,
      event,
      data,
      priority
    });
  }

  /**
   * 送信ジョブをキューに追加
   */
  private async enqueueSend(jobParams: {
    type: SendJob['type'];
    targets: string[];
    event: string;
    data: any;
    priority: SendPriority;
  }): Promise<SendResult> {
    const job: SendJob = {
      id: this.generateJobId(),
      type: jobParams.type,
      targets: jobParams.targets,
      event: jobParams.event,
      data: this.formatSendData(jobParams.data),
      attempts: 0,
      maxAttempts: this.options.maxAttempts,
      createdAt: new Date(),
      scheduledAt: new Date(),
      priority: jobParams.priority
    };

    if (!this.options.enableQueue) {
      // キューを使わない場合は即座に実行
      return this.executeSendJob(job);
    }

    // 優先度順でキューに挿入
    this.insertJobByPriority(job);
    
    this.logger.debug('Job enqueued', { 
      jobId: job.id, 
      type: job.type, 
      event: job.event,
      priority: job.priority,
      queueLength: this.sendQueue.length
    });

    return {
      success: true,
      jobId: job.id
    };
  }

  /**
   * 優先度順でジョブをキューに挿入
   */
  private insertJobByPriority(job: SendJob): void {
    let insertIndex = this.sendQueue.length;
    
    for (let i = 0; i < this.sendQueue.length; i++) {
      if (this.sendQueue[i].priority < job.priority) {
        insertIndex = i;
        break;
      }
    }
    
    this.sendQueue.splice(insertIndex, 0, job);
  }

  /**
   * キュー処理の開始
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.processing && this.sendQueue.length > 0) {
        this.processQueue();
      }
    }, this.options.queueProcessInterval);
  }

  /**
   * キューの処理
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;
    
    try {
      const now = new Date();
      const jobsToProcess: SendJob[] = [];
      
      // 実行時刻が来たジョブを取得（最大同時実行数まで）
      for (let i = 0; i < Math.min(this.sendQueue.length, this.options.maxConcurrentSends); i++) {
        const job = this.sendQueue[i];
        if (job.scheduledAt <= now) {
          jobsToProcess.push(job);
        }
      }
      
      if (jobsToProcess.length === 0) {
        return;
      }
      
      // ジョブをキューから削除
      jobsToProcess.forEach(job => {
        const index = this.sendQueue.findIndex(j => j.id === job.id);
        if (index !== -1) {
          this.sendQueue.splice(index, 1);
        }
      });
      
      // 並列でジョブを実行
      const results = await Promise.allSettled(
        jobsToProcess.map(job => this.executeSendJob(job))
      );
      
      // 失敗したジョブのリトライ処理
      results.forEach((result, index) => {
        const job = jobsToProcess[index];
        
        if (result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.success)) {
          this.handleJobFailure(job, result.status === 'rejected' ? String(result.reason) : result.value.error);
        }
      });
      
    } catch (error) {
      this.logger.error('Error processing queue', error);
    } finally {
      this.processing = false;
    }
  }

  /**
   * 送信ジョブの実行
   */
  private async executeSendJob(job: SendJob): Promise<SendResult> {
    job.attempts++;
    
    this.logger.debug('Executing send job', { 
      jobId: job.id, 
      type: job.type, 
      event: job.event,
      attempt: job.attempts,
      targets: job.targets.length 
    });

    try {
      let deliveredCount = 0;
      const failedTargets: string[] = [];

      switch (job.type) {
        case 'user':
          if (job.targets.length > 0) {
            this.io.to(job.targets[0]).emit(job.event, job.data);
            deliveredCount = 1;
          }
          break;

        case 'room':
          if (job.targets.length > 0) {
            this.io.to(job.targets[0]).emit(job.event, job.data);
            deliveredCount = 1;
          }
          break;

        case 'broadcast':
          this.io.emit(job.event, job.data);
          deliveredCount = 1; // 正確な数は取得困難
          break;

        case 'users':
          for (const userId of job.targets) {
            try {
              this.io.to(userId).emit(job.event, job.data);
              deliveredCount++;
            } catch (error) {
              failedTargets.push(userId);
              this.logger.warn('Failed to send to user', { userId, error });
            }
          }
          break;

        default:
          throw new Error(`Unknown send type: ${job.type}`);
      }

      this.logger.info('Send job completed', { 
        jobId: job.id, 
        deliveredCount, 
        failedTargets: failedTargets.length 
      });

      return {
        success: failedTargets.length === 0,
        jobId: job.id,
        deliveredCount,
        failedTargets
      };

    } catch (error) {
      this.logger.error('Send job execution failed', error, { jobId: job.id });
      
      return {
        success: false,
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * ジョブ失敗時の処理
   */
  private handleJobFailure(job: SendJob, error?: string): void {
    if (job.attempts < job.maxAttempts) {
      // リトライをスケジュール
      job.scheduledAt = new Date(Date.now() + this.options.retryDelay * job.attempts);
      this.insertJobByPriority(job);
      
      this.logger.warn('Job failed, scheduling retry', { 
        jobId: job.id, 
        attempt: job.attempts, 
        nextRetry: job.scheduledAt,
        error 
      });
    } else {
      // 最大試行回数に達した
      this.logger.error('Job failed permanently', { 
        jobId: job.id, 
        attempts: job.attempts,
        error 
      });
      
      this.onJobFailedPermanently(job, error);
    }
  }

  /**
   * 永続的に失敗したジョブの処理（サブクラスでオーバーライド可能）
   */
  protected onJobFailedPermanently(job: SendJob, error?: string): void {
    // デフォルトでは何もしない
    // サブクラスで必要に応じてオーバーライド
  }

  /**
   * 送信データの共通フォーマット
   */
  private formatSendData(data: any): any {
    return {
      ...data,
      timestamp: new Date(),
      serverId: process.env.SERVER_ID || 'unknown'
    };
  }

  /**
   * ジョブIDの生成
   */
  private generateJobId(): string {
    return `${this.constructor.name}-${Date.now()}-${++this.jobIdCounter}`;
  }

  /**
   * キューの状態を取得
   */
  protected getQueueStatus(): {
    queueLength: number;
    processing: boolean;
    oldestJob?: Date;
  } {
    return {
      queueLength: this.sendQueue.length,
      processing: this.processing,
      oldestJob: this.sendQueue.length > 0 ? this.sendQueue[this.sendQueue.length - 1].createdAt : undefined
    };
  }

  /**
   * キューのクリア
   */
  protected clearQueue(): void {
    this.sendQueue = [];
    this.logger.info('Queue cleared');
  }
}
