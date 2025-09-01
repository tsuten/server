import { modelRegistry } from './ModelRegistry.js';
import { authOperation } from '../operations/authOperation.js';
import { messageOperation } from '../operations/MessageOperation.js';
import { roomOperation } from '../operations/roomOperation.js';
import { createLogger, LogCategory } from '../utils/consoleLog.js';

const logger = createLogger(LogCategory.SYSTEM, 'ModelSetup');

/**
 * 全モデルを動的に登録
 * 新しいモデルを追加する場合はここに追加するだけ
 */
export function setupAllModels(): void {
    logger.info('Setting up all models for admin panel');

    // 認証モデル
    modelRegistry.register({
        name: 'auth',
        displayName: 'ユーザー',
        operation: authOperation,
        hasStatistics: true,
        hasSearch: true,
        color: '#4CAF50',
        icon: '👤',
        createEnabled: true,
        pagination: {
            itemsPerPage: 10,
            showId: true,
            sortBy: 'createdAt',
            sortOrder: 'desc'
        },
        fields: [
            {
                name: 'username',
                type: 'string',
                required: true,
                minLength: 3,
                maxLength: 50,
                label: 'ユーザー名',
                placeholder: 'ユーザー名を入力してください',
                description: '3-50文字の英数字'
            },
            {
                name: 'password',
                type: 'password',
                required: true,
                minLength: 6,
                maxLength: 100,
                label: 'パスワード',
                placeholder: 'パスワードを入力してください',
                description: '6文字以上のパスワード'
            }
        ]
    });

    // メッセージモデル  
    modelRegistry.register({
        name: 'messages',
        displayName: 'メッセージ',
        operation: messageOperation,
        hasStatistics: false,
        hasSearch: true,
        color: '#2196F3',
        icon: '💬',
        createEnabled: true,
        pagination: {
            itemsPerPage: 15,
            showId: true,
            sortBy: 'timestamp',
            sortOrder: 'desc'
        },
        fields: [
            {
                name: 'username',
                type: 'string',
                required: true,
                maxLength: 50,
                label: 'ユーザー名',
                placeholder: 'ユーザー名を入力してください'
            },
            {
                name: 'message',
                type: 'string',
                required: true,
                minLength: 1,
                maxLength: 1000,
                label: 'メッセージ',
                placeholder: 'メッセージを入力してください',
                description: '最大1000文字'
            },
            {
                name: 'room',
                type: 'string',
                required: false,
                maxLength: 100,
                label: 'ルーム',
                placeholder: 'ルーム名（省略時はgeneral）',
                default: 'general'
            },
            {
                name: 'type',
                type: 'enum',
                required: false,
                enum: ['text', 'system', 'notification'],
                default: 'text',
                label: 'メッセージタイプ',
                description: 'メッセージの種類を選択'
            }
        ]
    });

    // ルームモデル
    modelRegistry.register({
        name: 'rooms',
        displayName: 'ルーム',
        operation: roomOperation,
        hasStatistics: true,
        hasSearch: false,
        color: '#FF9800',
        icon: '🏠',
        createEnabled: true,
        pagination: {
            itemsPerPage: 8,
            showId: true,
            sortBy: 'lastActivity',
            sortOrder: 'desc'
        },
        fields: [
            {
                name: 'name',
                type: 'string',
                required: true,
                minLength: 1,
                maxLength: 100,
                label: 'ルーム名',
                placeholder: 'ルーム名を入力してください',
                description: 'ユニークなルーム名'
            },
            {
                name: 'description',
                type: 'string',
                required: false,
                maxLength: 500,
                label: '説明',
                placeholder: 'ルームの説明を入力してください（任意）'
            },
            {
                name: 'type',
                type: 'enum',
                required: false,
                enum: ['channel', 'group', 'forum', 'general'],
                default: 'general',
                label: 'ルームタイプ',
                description: 'ルームの種類を選択'
            },
            {
                name: 'isDefault',
                type: 'boolean',
                required: false,
                default: false,
                label: 'デフォルトルーム',
                description: 'デフォルトルームとして設定'
            }
        ]
    });

    const registeredModels = modelRegistry.getAllModels();
    logger.info('Models registered successfully', {
        count: registeredModels.length,
        models: registeredModels.map(m => ({ name: m.name, displayName: m.displayName }))
    });
}

/**
 * 特定のカテゴリのモデルのみ登録（オプション）
 */
export function setupModelsByCategory(category: 'core' | 'communication' | 'all' = 'all'): void {
    logger.info(`Setting up ${category} models`);

    if (category === 'core' || category === 'all') {
        modelRegistry.register({
            name: 'auth',
            displayName: 'ユーザー',
            operation: authOperation,
            hasStatistics: true,
            hasSearch: true,
            color: '#4CAF50',
            icon: '👤'
        });

        modelRegistry.register({
            name: 'rooms',
            displayName: 'ルーム',
            operation: roomOperation,
            hasStatistics: true,
            hasSearch: false,
            color: '#FF9800',
            icon: '🏠'
        });
    }

    if (category === 'communication' || category === 'all') {
        modelRegistry.register({
            name: 'messages',
            displayName: 'メッセージ',
            operation: messageOperation,
            hasStatistics: false,
            hasSearch: true,
            color: '#2196F3',
            icon: '💬'
        });
    }
}

/**
 * 将来の拡張のための自動検出機能（プロトタイプ）
 */
export async function autoDiscoverModels(): Promise<void> {
    logger.info('Auto-discovering models (future feature)');
    
    try {
        // 将来的にはoperationsディレクトリを動的にスキャンして
        // BaseOperationを継承したクラスを自動検出する
        const fs = await import('fs');
        const path = await import('path');
        
        const operationsDir = path.join(process.cwd(), 'src', 'operations');
        
        if (fs.existsSync(operationsDir)) {
            const files = fs.readdirSync(operationsDir);
            const operationFiles = files.filter(file => 
                file.endsWith('Operation.ts') || file.endsWith('Operation.js')
            );
            
            logger.debug('Found operation files', { files: operationFiles });
            
            // 現在は手動設定、将来的には動的インポートで自動化
            // for (const file of operationFiles) {
            //     const modulePath = path.join(operationsDir, file);
            //     const module = await import(modulePath);
            //     // BaseOperationを継承しているかチェックして自動登録
            // }
        }
    } catch (error) {
        logger.warn('Auto-discovery not available yet', error);
    }
}
