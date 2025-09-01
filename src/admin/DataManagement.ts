import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createLogger, LogCategory } from '../utils/consoleLog.js';
import { modelRegistry } from './ModelRegistry.js';
import { setupAllModels } from './setupModels.js';
import path from 'path';

export async function dataManagement(fastify: FastifyInstance) {
    const logger = createLogger(LogCategory.SYSTEM, 'AdminPanel');
    
    // モデルを動的に設定
    setupAllModels();
    
    // テスト用の簡単なページ
    fastify.get('/test', async (request: FastifyRequest, reply: FastifyReply) => {
        logger.info('Test endpoint accessed');
        reply.type('text/html').send(`
            <html>
                <head><title>Admin Test</title></head>
                <body>
                    <h1>管理パネル テストページ</h1>
                    <p>このページが表示されれば、ルートは正常に動作しています。</p>
                    <p>時刻: ${new Date().toLocaleString('ja-JP')}</p>
                    <p><a href="/admin">メインの管理パネルに戻る</a></p>
                </body>
            </html>
        `);
    });

    // CSSファイルの静的配信
    fastify.get('/style.css', async (request: FastifyRequest, reply: FastifyReply) => {
        logger.info('CSS file requested');
        try {
            const fs = await import('fs');
            const cssPath = path.join(process.cwd(), 'src', 'admin', 'templates', 'style.css');
            
            if (fs.existsSync(cssPath)) {
                const cssContent = fs.readFileSync(cssPath, 'utf8');
                reply.type('text/css').send(cssContent);
                logger.info('CSS file served successfully');
            } else {
                logger.error('CSS file not found', { cssPath });
                reply.status(404).send('CSS file not found');
            }
        } catch (error) {
            logger.error('Error serving CSS file', error);
            reply.status(500).send('Internal server error');
        }
    });
    
    // 管理パネルのメインページ
    fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
        logger.info('Admin panel accessed', { url: request.url, ip: request.ip });
        
        try {
            logger.debug('Starting dynamic data collection for admin panel');
            
            // 動的に全モデルの統計情報を取得
            logger.debug('Fetching statistics for all registered models');
            const allStatistics = await modelRegistry.getAllStatistics();
            
            // 動的に全モデルの最新データを取得
            logger.debug('Fetching latest data for all registered models');
            const allLatestData = await modelRegistry.getAllLatestData(20);
            
            // 登録されたモデル情報を取得
            const registeredModels = modelRegistry.getAllModels();
            
            logger.debug('Dynamic data collection results', {
                modelsCount: registeredModels.length,
                statisticsKeys: Object.keys(allStatistics),
                latestDataKeys: Object.keys(allLatestData)
            });

            const data = {
                title: 'データ管理パネル（動的）',
                models: registeredModels,
                statistics: allStatistics,
                latestData: allLatestData,
                totalModels: registeredModels.length,
                timestamp: new Date().toISOString(),
                // 後方互換性のための旧形式データ
                stats: {
                    users: allStatistics.auth || { totalUsers: 0, recentRegistrations: 0, activeUsers: 0 },
                    totalMessages: allStatistics.messages?.total || 0,
                    totalRooms: allStatistics.rooms?.total || 0
                },
                rooms: allLatestData.rooms || [],
                latestMessages: allLatestData.messages || []
            };

            logger.debug('Template data prepared', {
                dataKeys: Object.keys(data),
                statsKeys: Object.keys(data.stats),
                roomsCount: data.rooms?.length || 0,
                messagesCount: data.latestMessages?.length || 0
            });

            logger.info('Rendering admin panel template');
            
            // テンプレートファイルの存在チェック
            try {
                const fs = await import('fs');
                const templatePath = path.join(process.cwd(), 'src', 'admin', 'templates', 'index.ejs');
                logger.debug('Template path', { templatePath });
                
                if (fs.existsSync(templatePath)) {
                    logger.info('Template file exists, proceeding with render');
                    try {
                        await reply.view('admin/templates/index.ejs', data);
                        logger.info('Admin panel template rendered successfully');
                    } catch (viewError) {
                        logger.error('Error rendering EJS template', viewError, { data });
                        reply.type('text/html').send(`
                            <html>
                                <body>
                                    <h1>Admin Panel (Template Error)</h1>
                                    <p>EJSテンプレートのレンダリングでエラーが発生しました:</p>
                                    <pre>${viewError instanceof Error ? viewError.message : String(viewError)}</pre>
                                    <p>Data: ${JSON.stringify(data, null, 2)}</p>
                                </body>
                            </html>
                        `);
                    }
                } else {
                    logger.error('Template file not found', null, { templatePath });
                    reply.type('text/html').send(`
                        <html>
                            <body>
                                <h1>Admin Panel (Fallback)</h1>
                                <p>Template file not found at: ${templatePath}</p>
                                <p>Data: ${JSON.stringify(data, null, 2)}</p>
                            </body>
                        </html>
                    `);
                }
            } catch (fsError) {
                logger.error('Error checking template file', fsError);
                reply.type('text/html').send(`
                    <html>
                        <body>
                            <h1>Admin Panel (Error Fallback)</h1>
                            <p>Error checking template: ${fsError}</p>
                            <p>Data: ${JSON.stringify(data, null, 2)}</p>
                        </body>
                    </html>
                `);
            }
            
        } catch (error) {
            logger.error('Error loading admin panel', error, {
                url: request.url,
                method: request.method,
                headers: request.headers
            });
            
            reply.code(500).send({
                error: 'Failed to load admin panel',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // 動的APIルートの生成と登録
    logger.info('Generating dynamic API routes');
    const dynamicRoutes = modelRegistry.generateApiRoutes();
    
    dynamicRoutes.forEach(route => {
        logger.debug('Registering dynamic route', { 
            path: route.path, 
            method: route.method 
        });
        
        if (route.method === 'GET') {
            fastify.get(route.path, route.handler);
        }
        // 他のHTTPメソッドも将来的に対応可能
    });

    // 全モデル情報API（新機能）
    fastify.get('/api/models', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const models = modelRegistry.getAllModels();
            reply.send({
                success: true,
                data: models.map(model => ({
                    name: model.name,
                    displayName: model.displayName,
                    hasStatistics: model.hasStatistics,
                    hasSearch: model.hasSearch,
                    color: model.color,
                    icon: model.icon
                })),
                total: models.length
            });
        } catch (error) {
            logger.error('Error getting model information', error);
            reply.code(500).send({
                error: 'Failed to get model information',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // 全統計情報API（新機能）
    fastify.get('/api/statistics', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const statistics = await modelRegistry.getAllStatistics();
            reply.send({
                success: true,
                data: statistics,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error getting all statistics', error);
            reply.code(500).send({
                error: 'Failed to get statistics',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // フィールド情報取得API
    fastify.get('/api/:modelName/fields', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { modelName } = request.params as { modelName: string };
            const fields = modelRegistry.getCreateFields(modelName);
            
            reply.send({
                success: true,
                data: fields,
                modelName
            });
        } catch (error) {
            logger.error('Error getting model fields', error);
            reply.code(500).send({
                error: 'Failed to get model fields',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // 新規データ作成API
    fastify.post('/api/:modelName/create', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { modelName } = request.params as { modelName: string };
            const data = request.body;
            
            logger.info('Creating new data', { modelName, data });
            
            const result = await modelRegistry.createData(modelName, data);
            
            if (result.success) {
                logger.info('Data created successfully', { modelName, id: result.data?._id });
            }
            
            reply.send(result);
        } catch (error) {
            logger.error('Error creating data', error, { modelName: (request.params as any).modelName });
            reply.code(500).send({
                success: false,
                error: 'Failed to create data',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // ページネーション付きデータ取得API
    fastify.get('/api/:modelName/paginated', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { modelName } = request.params as { modelName: string };
            const { page = '1', itemsPerPage } = request.query as { page?: string, itemsPerPage?: string };
            
            const pageNumber = parseInt(page, 10);
            const itemsPerPageNumber = itemsPerPage ? parseInt(itemsPerPage, 10) : undefined;
            
            if (isNaN(pageNumber) || pageNumber < 1) {
                logger.error('Invalid page number', { page, pageNumber });
                reply.code(400).send({
                    success: false,
                    error: 'Invalid page number'
                });
                return;
            }
            
            if (itemsPerPageNumber && (isNaN(itemsPerPageNumber) || itemsPerPageNumber < 1 || itemsPerPageNumber > 100)) {
                logger.error('Invalid itemsPerPage', { itemsPerPage, itemsPerPageNumber });
                reply.code(400).send({
                    success: false,
                    error: 'Invalid itemsPerPage (must be between 1 and 100)'
                });
                return;
            }
            
            logger.info('Getting paginated data', { modelName, page: pageNumber, itemsPerPage: itemsPerPageNumber });
            
            const result = await modelRegistry.getPaginatedData(modelName, pageNumber, itemsPerPageNumber);
            
            reply.send(result);
        } catch (error) {
            logger.error('Error getting paginated data', error, { modelName: (request.params as any).modelName });
            reply.code(500).send({
                success: false,
                error: 'Failed to get paginated data',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // ページネーション設定取得API
    fastify.get('/api/:modelName/pagination-config', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { modelName } = request.params as { modelName: string };
            const config = modelRegistry.getPaginationConfig(modelName);
            
            reply.send({
                success: true,
                data: config,
                modelName
            });
        } catch (error) {
            logger.error('Error getting pagination config', error);
            reply.code(500).send({
                success: false,
                error: 'Failed to get pagination config',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
}