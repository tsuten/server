import { BaseOperation } from '../base/BaseOperation.js';
import { createLogger, LogCategory } from '../utils/consoleLog.js';

/**
 * フィールド情報の定義
 */
export interface FieldInfo {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'password';
    required?: boolean;
    maxLength?: number;
    minLength?: number;
    min?: number;
    max?: number;
    enum?: string[];
    default?: any;
    label?: string;
    placeholder?: string;
    description?: string;
}

/**
 * ページネーション情報の定義
 */
export interface PaginationInfo {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNext: boolean;
    hasPrev: boolean;
}

/**
 * ページネーション設定の定義
 */
export interface PaginationConfig {
    itemsPerPage?: number;  // 1ページあたりの件数
    showId?: boolean;       // IDカラムを表示するか
    sortBy?: string;        // ソートフィールド
    sortOrder?: 'asc' | 'desc';  // ソート順
}

/**
 * モデル情報の定義
 */
export interface ModelInfo {
    name: string;
    displayName: string;
    operation: BaseOperation<any, any, any>;
    hasStatistics?: boolean;
    hasSearch?: boolean;
    color?: string;
    icon?: string;
    fields?: FieldInfo[];  // 新規追加フォーム用フィールド定義
    createEnabled?: boolean;  // 新規作成可能かどうか
    pagination?: PaginationConfig;  // ページネーション設定
}

/**
 * 動的モデルレジストリ
 * 新しいモデルを自動的に検出・管理する
 */
export class ModelRegistry {
    private static instance: ModelRegistry;
    private models: Map<string, ModelInfo> = new Map();
    private logger = createLogger(LogCategory.SYSTEM, 'ModelRegistry');

    private constructor() {}

    static getInstance(): ModelRegistry {
        if (!ModelRegistry.instance) {
            ModelRegistry.instance = new ModelRegistry();
        }
        return ModelRegistry.instance;
    }

    /**
     * モデルを登録
     */
    register(modelInfo: ModelInfo): void {
        this.logger.info('Registering model', { 
            name: modelInfo.name, 
            displayName: modelInfo.displayName 
        });
        this.models.set(modelInfo.name, modelInfo);
    }

    /**
     * 全モデルを取得
     */
    getAllModels(): ModelInfo[] {
        return Array.from(this.models.values());
    }

    /**
     * 特定モデルを取得
     */
    getModel(name: string): ModelInfo | undefined {
        return this.models.get(name);
    }

    /**
     * 全モデルの統計情報を動的に取得
     */
    async getAllStatistics(): Promise<Record<string, any>> {
        const statistics: Record<string, any> = {};
        
        for (const [name, modelInfo] of this.models) {
            try {
                this.logger.debug(`Fetching statistics for ${name}`);
                
                // カウント取得
                const countResult = await modelInfo.operation.count();
                statistics[name] = {
                    total: countResult.success ? countResult.data : 0,
                    name: modelInfo.displayName,
                    color: modelInfo.color || '#667eea'
                };

                // 統計メソッドがある場合は追加情報を取得
                if (modelInfo.hasStatistics && (modelInfo.operation as any).getUserStatistics) {
                    const statsResult = await (modelInfo.operation as any).getUserStatistics();
                    if (statsResult.success) {
                        statistics[name] = { ...statistics[name], ...statsResult.data };
                    }
                }

            } catch (error) {
                this.logger.error(`Error fetching statistics for ${name}`, error);
                statistics[name] = {
                    total: 0,
                    name: modelInfo.displayName,
                    error: 'Failed to fetch data'
                };
            }
        }

        return statistics;
    }

    /**
     * 全モデルの最新データを取得
     */
    async getAllLatestData(limit: number = 20): Promise<Record<string, any[]>> {
        const latestData: Record<string, any[]> = {};
        
        for (const [name, modelInfo] of this.models) {
            try {
                this.logger.debug(`Fetching latest data for ${name}`);
                
                // BaseOperationのfindManyメソッドを使用
                const result = await modelInfo.operation.findMany({}, { 
                    limit, 
                    sort: { createdAt: -1 } 
                });
                
                latestData[name] = result.success ? (result.data || []) : [];
                
            } catch (error) {
                this.logger.error(`Error fetching latest data for ${name}`, error);
                latestData[name] = [];
            }
        }

        return latestData;
    }

    /**
     * 動的APIルートを生成
     */
    generateApiRoutes(): Array<{
        path: string;
        method: string;
        handler: (request: any, reply: any) => Promise<void>;
    }> {
        const routes: Array<{
            path: string;
            method: string;
            handler: (request: any, reply: any) => Promise<void>;
        }> = [];

        for (const [name, modelInfo] of this.models) {
            // 一覧取得API
            routes.push({
                path: `/api/${name}`,
                method: 'GET',
                handler: async (request: any, reply: any) => {
                    try {
                        const { limit = 50, skip = 0 } = request.query;
                        const result = await modelInfo.operation.findMany({}, { 
                            limit: Number(limit), 
                            skip: Number(skip) 
                        });
                        
                        reply.send({
                            success: result.success,
                            data: result.data || [],
                            total: result.data?.length || 0,
                            model: modelInfo.displayName
                        });
                    } catch (error) {
                        this.logger.error(`Error in ${name} API`, error);
                        reply.code(500).send({
                            error: `Failed to get ${name} data`,
                            message: error instanceof Error ? error.message : 'Unknown error'
                        });
                    }
                }
            });

            // 統計取得API
            routes.push({
                path: `/api/${name}/stats`,
                method: 'GET',
                handler: async (request: any, reply: any) => {
                    try {
                        const countResult = await modelInfo.operation.count();
                        let stats: any = {
                            total: countResult.success ? countResult.data : 0,
                            model: modelInfo.displayName
                        };

                        // 特別な統計メソッドがある場合
                        if (modelInfo.hasStatistics && (modelInfo.operation as any).getUserStatistics) {
                            const specialStats = await (modelInfo.operation as any).getUserStatistics();
                            if (specialStats.success) {
                                stats = { ...stats, ...specialStats.data };
                            }
                        }

                        reply.send({
                            success: true,
                            data: stats
                        });
                    } catch (error) {
                        this.logger.error(`Error in ${name} stats API`, error);
                        reply.code(500).send({
                            error: `Failed to get ${name} statistics`,
                            message: error instanceof Error ? error.message : 'Unknown error'
                        });
                    }
                }
            });
        }

        return routes;
    }

    /**
     * モデルの作成用フィールド情報を取得
     */
    getCreateFields(modelName: string): FieldInfo[] {
        const model = this.getModel(modelName);
        return model?.fields || [];
    }

    /**
     * ページネーション設定を取得
     */
    getPaginationConfig(modelName: string): Required<PaginationConfig> {
        const model = this.getModel(modelName);
        const defaultConfig: Required<PaginationConfig> = {
            itemsPerPage: 10,
            showId: true,
            sortBy: '_id',
            sortOrder: 'desc'
        };
        
        return {
            ...defaultConfig,
            ...model?.pagination
        };
    }

    /**
     * ページネーション付きでデータを取得
     */
    async getPaginatedData(
        modelName: string, 
        page: number = 1, 
        itemsPerPage?: number
    ): Promise<{success: boolean, data?: any[], pagination?: PaginationInfo, error?: string}> {
        try {
            const model = this.getModel(modelName);
            if (!model) {
                return {
                    success: false,
                    error: `Model ${modelName} not found`
                };
            }

            const config = this.getPaginationConfig(modelName);
            const perPage = itemsPerPage || config.itemsPerPage;
            const skip = (page - 1) * perPage;

            // 総件数を取得
            const countResult = await model.operation.count({});
            if (!countResult.success) {
                throw new Error(`Failed to count ${modelName}: ${countResult.error}`);
            }
            const totalItems = countResult.data;

            // データを取得
            const sortOptions: any = {};
            sortOptions[config.sortBy] = config.sortOrder === 'asc' ? 1 : -1;

            const result = await model.operation.findMany(
                {}, 
                { 
                    limit: perPage, 
                    skip: skip,
                    sort: sortOptions
                }
            );

            if (!result.success) {
                return result;
            }

            // ページネーション情報を計算
            const totalPages = Math.ceil(totalItems / perPage);
            const pagination: PaginationInfo = {
                currentPage: Number(page),
                totalPages: Number(totalPages),
                totalItems: Number(totalItems),
                itemsPerPage: Number(perPage),
                hasNext: page < totalPages,
                hasPrev: page > 1
            };

            this.logger.info(`Pagination calculated for ${modelName}`, {
                currentPage: pagination.currentPage,
                totalPages: pagination.totalPages,
                totalItems: pagination.totalItems,
                itemsPerPage: pagination.itemsPerPage
            });

            return {
                success: true,
                data: result.data,
                pagination: pagination
            };

        } catch (error) {
            this.logger.error(`Error getting paginated data for ${modelName}`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    /**
     * 新規データ作成
     */
    async createData(modelName: string, data: any): Promise<{success: boolean, data?: any, error?: string}> {
        try {
            const model = this.getModel(modelName);
            if (!model) {
                return {
                    success: false,
                    error: `Model ${modelName} not found`
                };
            }

            if (!model.createEnabled) {
                return {
                    success: false,
                    error: `Creation not enabled for ${model.displayName}`
                };
            }

            // フィールド検証
            const validationResult = this.validateCreateData(modelName, data);
            if (!validationResult.isValid) {
                return {
                    success: false,
                    error: validationResult.errors.join(', ')
                };
            }

            // データ作成
            const result = await model.operation.create(data);
            return result;

        } catch (error) {
            this.logger.error(`Error creating data for ${modelName}`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    /**
     * 作成データの検証
     */
    private validateCreateData(modelName: string, data: any): {isValid: boolean, errors: string[]} {
        const fields = this.getCreateFields(modelName);
        const errors: string[] = [];

        for (const field of fields) {
            const value = data[field.name];

            // 必須フィールドチェック
            if (field.required && (value === undefined || value === null || value === '')) {
                errors.push(`${field.label || field.name}は必須です`);
                continue;
            }

            // 値が存在する場合のみ検証
            if (value !== undefined && value !== null && value !== '') {
                // 文字列長チェック
                if (field.type === 'string' && typeof value === 'string') {
                    if (field.minLength && value.length < field.minLength) {
                        errors.push(`${field.label || field.name}は${field.minLength}文字以上である必要があります`);
                    }
                    if (field.maxLength && value.length > field.maxLength) {
                        errors.push(`${field.label || field.name}は${field.maxLength}文字以下である必要があります`);
                    }
                }

                // 数値範囲チェック
                if (field.type === 'number' && typeof value === 'number') {
                    if (field.min !== undefined && value < field.min) {
                        errors.push(`${field.label || field.name}は${field.min}以上である必要があります`);
                    }
                    if (field.max !== undefined && value > field.max) {
                        errors.push(`${field.label || field.name}は${field.max}以下である必要があります`);
                    }
                }

                // 列挙値チェック
                if (field.type === 'enum' && field.enum && !field.enum.includes(value)) {
                    errors.push(`${field.label || field.name}は有効な値である必要があります`);
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

// シングルトンインスタンス
export const modelRegistry = ModelRegistry.getInstance();
export default modelRegistry;
