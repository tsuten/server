import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { serverOperation } from '../operations/serverOperation.js';
import { authOperation } from '../operations/authOperation.js';
import { adminRepository } from '../repositories/authRepository.js';
import { serverRepository } from '../repositories/serverRepository.js';
import { calculateResourceCostForEachConnection } from '../utils/calculateResourceCostForEachConnection.js';

export async function setupRoutes(fastify: FastifyInstance) {
    fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
        const result = await serverOperation.get();
        if (!result.success) {
            return reply.status(400).send({ success: false, error: result.error });
        }
        return reply.send({ success: true, server: result.data });
    });

    fastify.get('/:step', async (request: FastifyRequest, reply: FastifyReply) => {
        const step = (request.params as { step: string }).step;
        switch (step) {
            case '1':
                return reply.send({
                    success: true,
                    step: 1,
                    step_description: "Create super admin",
                    data_schema: {
                        username: {
                            type: "string",
                            required: true,
                            description: "Administrator username"
                        },
                        password: {
                            type: "string",
                            required: true,
                            description: "Primary admin password (minimum 8 characters)"
                        },
                        password2: {
                            type: "string",
                            required: true,
                            description: "Secondary admin password for enhanced security"
                        },
                        email: {
                            type: "string",
                            required: true,
                            description: "Administrator email address"
                        }
                    }
                });
            case '2':
                return reply.send({
                    success: true,
                    step: 2,
                    step_description: "Set server info",
                    data_schema: {
                        name: {
                            type: "string",
                            required: true
                        },
                        description: {
                            type: "string",
                            required: true
                        },
                        logo: {
                            type: "string",
                            required: true
                        },
                        language: {
                            type: "string",
                            required: true
                        },
                        max_members: {
                            type: "number",
                            required: true
                        },
                        categories: {
                            type: "array",
                            required: true,
                            items: {
                                type: "string",
                                required: true
                            }
                        }
                    }
                });
            case '3':
                return reply.send({
                    success: true,
                    step: 3,
                    step_description: "Set server settings",
                    data_schema: {
                        settings: {
                            type: "object",
                            required: true,
                            properties: {
                                is_private: { 
                                    type: "boolean",
                                    required: true,
                                    description: "Whether the server is private or public"
                                },
                                max_members: {
                                    type: "number",
                                    required: true,
                                    description: "Maximum number of members allowed (1-100000)",
                                    minimum: 1,
                                    maximum: 100000
                                }
                            }
                        }
                    }
                });
            default:
                return reply.status(400).send({ success: false, error: "Invalid step" });
        }
    });

    fastify.post('/:step', async (request: FastifyRequest, reply: FastifyReply) => {
        const step = (request.params as { step: string }).step;
        const body = request.body as any;
        switch (step) {
            case '1':
                if (!body.username || !body.password || !body.password2 || !body.email) {
                    return reply.status(400).send({ 
                        success: false, 
                        error: "Username, password, password2, and email are required" 
                    });
                }
                return reply.send(await createSuperAdmin(body.username, body.password, body.password2, body.email));
            case '2':
                if (!body.name || !body.description) {
                    return reply.status(400).send({ 
                        success: false, 
                        error: "Name and description are required" 
                    });
                }
                return reply.send(await setServerInfo(body));
            case '3':
                if (!body.settings || typeof body.settings !== 'object') {
                    return reply.status(400).send({ 
                        success: false, 
                        error: "Settings object is required" 
                    });
                }
                if (body.settings.is_private === undefined || body.settings.max_members === undefined) {
                    return reply.status(400).send({ 
                        success: false, 
                        error: "is_private and max_members are required in settings" 
                    });
                }
                return reply.send(await setServerSettings(body.settings));
            default:
                return reply.status(400).send({ success: false, error: "Invalid step" });
        }
    });

    const createSuperAdmin = async (username: string, password: string, password2: string, email: string) => {
        try {
            // 管理者作成データの準備
            const adminData = {
                username,
                password,
                password2,
                email,
                is_admin: true as const
            };

            // 管理者専用リポジトリで作成
            const result = await adminRepository.createAdmin(adminData);

            if (!result.success) {
                return { 
                    success: false, 
                    error: result.error,
                    validation_errors: result.errors 
                };
            }

            return {
                success: true,
                message: "Super admin created successfully",
                admin: {
                    id: result.data?._id,
                    username: result.data?.username,
                    email: result.data?.email,
                    is_admin: result.data?.is_admin
                }
            };
        } catch (error) {
            console.error('Error creating super admin:', error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error occurred' 
            };
        }
    }

    const setServerInfo = async (data: any) => {
        try {
            // サーバー情報作成データの準備
            const serverData = {
                name: data.name,
                description: data.description,
                logo: data.logo || undefined,
                language: data.language || undefined,
                categories: data.categories || undefined
            };

            // serverRepositoryでサーバー情報を作成
            const result = await serverRepository.create(serverData);

            if (!result.success) {
                return { 
                    success: false, 
                    error: result.error,
                    validation_errors: result.errors 
                };
            }

            return {
                success: true,
                message: "Server information set successfully",
                server: {
                    id: result.data?._id,
                    name: result.data?.name,
                    description: result.data?.description,
                    logo: result.data?.logo,
                    language: result.data?.language,
                    categories: result.data?.categories
                }
            };
        } catch (error) {
            console.error('Error setting server info:', error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error occurred' 
            };
        }
    }

    const setServerSettings = async (settings: any) => {
        try {
            // 設定データの準備（必要に応じてデフォルト値を設定）
            const settingsData = {
                is_private: settings.is_private !== undefined ? settings.is_private : false,
                max_members: settings.max_members !== undefined ? settings.max_members : 1000
            };

            // serverRepositoryでサーバー設定を更新
            const result = await serverRepository.update({ settings: settingsData });

            if (!result.success) {
                return { 
                    success: false, 
                    error: result.error,
                    validation_errors: result.errors 
                };
            }

            // max_membersに基づくリソース予測を計算
            const maxMembers = result.data?.settings?.max_members || 1000;
            const expectedResource = calculateResourceCostForEachConnection(maxMembers);

            return {
                success: true,
                message: "Server settings configured successfully",
                server: {
                    id: result.data?._id,
                    name: result.data?.name,
                    description: result.data?.description,
                    settings: result.data?.settings
                },
                expected_resource: {
                    total_members: expectedResource.totalMembers,
                    estimated_online_users: expectedResource.estimatedOnlineUsers,
                    active_connections: expectedResource.activeConnections,
                    memory: {
                        per_connection: expectedResource.memory.perConnection,
                        total: expectedResource.memory.total,
                        formatted: expectedResource.memory.formatted
                    },
                    network: {
                        per_connection: expectedResource.network.perConnection,
                        total: expectedResource.network.total,
                        formatted: expectedResource.network.formatted
                    },
                    recommendation: {
                        server_type: expectedResource.recommendation.serverType,
                        min_ram: expectedResource.recommendation.minRam,
                        min_bandwidth: expectedResource.recommendation.minBandwidth
                    }
                }
            };
        } catch (error) {
            console.error('Error setting server settings:', error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error occurred' 
            };
        }
    }
}

export default setupRoutes;