import { ServerEntity, ServerCreateData } from '../types/server.js';
import { OperationResult } from '../types/base.js';
import { serverRepository } from '../repositories/serverRepository.js';

/**
 * ServerOperation
 * サーバー設定のユースケース層（Repositoryをラップし、ポリシーを適用）
 */
export class ServerOperation {
  /**
   * サーバー作成（単一インスタンス制約）
   */
  async create(data: ServerCreateData): Promise<OperationResult<ServerEntity>> {
    return await serverRepository.create(data);
  }

  /**
   * サーバー取得
   */
  async get(): Promise<OperationResult<ServerEntity>> {
    return await serverRepository.get();
  }

  /**
   * IDで取得
   */
  async findById(id: string): Promise<OperationResult<ServerEntity>> {
    return await serverRepository.findById(id);
  }

  /**
   * サーバー更新
   */
  async update(partial: Partial<ServerCreateData>): Promise<OperationResult<ServerEntity>> {
    return await serverRepository.update(partial);
  }

  /**
   * サーバー削除
   */
  async delete(): Promise<OperationResult<ServerEntity>> {
    return await serverRepository.delete();
  }

  /**
   * 件数
   */
  async count(): Promise<OperationResult<number>> {
    return await serverRepository.count();
  }

  /**
   * カテゴリを追加（重複排除・トリム・空文字除外）
   */
  async addCategory(input: string | string[]): Promise<OperationResult<ServerEntity>> {
    // 現在のサーバーを取得
    const current = await serverRepository.get();
    if (!current.success || !current.data) {
      return { success: false, error: current.error || 'Server not found' };
    }

    // 入力を配列に正規化
    const incoming = Array.isArray(input) ? input : [input];
    const sanitizedIncoming = incoming
      .filter((v) => typeof v === 'string')
      .map((v) => v.trim())
      .filter((v) => v.length > 0 && v.length <= 50);

    const existing = Array.isArray(current.data.categories) ? current.data.categories : [];

    // 重複排除（小文字比較で一意化）
    const lowerSet = new Set(existing.map((c) => c.toLowerCase()));
    const merged: string[] = [...existing];
    for (const c of sanitizedIncoming) {
      if (!lowerSet.has(c.toLowerCase())) {
        lowerSet.add(c.toLowerCase());
        merged.push(c);
      }
    }

    return await serverRepository.update({ categories: merged });
  }
}

export const serverOperation = new ServerOperation();
export default serverOperation;


