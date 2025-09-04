/**
 * サーバーリソース使用量の算出結果
 */
export interface ResourceUsage {
  totalMembers: number;           // 総メンバー数
  estimatedOnlineUsers: number;   // 推定オンラインユーザー数（総数の1/10）
  activeConnections: number;      // アクティブWebSocket接続数
  memory: {
    perConnection: number;        // 接続あたりのメモリ使用量（MB）
    total: number;               // 総メモリ使用量（MB）
    formatted: string;           // フォーマット済み文字列
  };
  network: {
    perConnection: number;        // 接続あたりの帯域幅（Kbps）
    total: number;               // 総帯域幅（Kbps）
    formatted: string;           // フォーマット済み文字列
  };
  recommendation: {
    serverType: string;          // 推奨サーバータイプ
    minRam: number;              // 最小RAM要件（GB）
    minBandwidth: number;        // 最小帯域幅要件（Mbps）
  };
}

/**
 * サーバーリソースの基本単位
 */
interface ResourceConstants {
  ONLINE_RATIO: number;            // オンライン率（1/10 = 0.1）
  MEMORY_PER_CONNECTION: number;   // 接続あたりのメモリ使用量（MB）
  NETWORK_PER_CONNECTION: number;  // 接続あたりの帯域幅（Kbps）
  BASE_MEMORY: number;             // ベースメモリ使用量（MB）
}

/**
 * リソース計算で使用する定数
 */
const RESOURCE_CONSTANTS: ResourceConstants = {
  ONLINE_RATIO: 0.1,              // 10%がオンライン
  MEMORY_PER_CONNECTION: 2.5,     // 1接続あたり2.5MB（WebSocket + ユーザーセッション）
  NETWORK_PER_CONNECTION: 8,      // 1接続あたり8Kbps（リアルタイムメッセージング）
  BASE_MEMORY: 512                // ベースメモリ512MB（アプリケーション本体）
};

/**
 * 参加メンバー数に基づいてサーバーリソースの使用量を算出する
 * 
 * @param totalMembers 総メンバー数
 * @returns リソース使用量の詳細
 */
export function calculateResourceCostForEachConnection(totalMembers: number): ResourceUsage {
  // 入力値の検証
  if (totalMembers < 0) {
    throw new Error('Total members must be a non-negative number');
  }
  
  if (totalMembers === 0) {
    return createEmptyResourceUsage();
  }

  // 基本計算
  const estimatedOnlineUsers = Math.ceil(totalMembers * RESOURCE_CONSTANTS.ONLINE_RATIO);
  const activeConnections = estimatedOnlineUsers; // 1ユーザー = 1接続

  // メモリ使用量計算
  const memoryPerConnection = RESOURCE_CONSTANTS.MEMORY_PER_CONNECTION;
  const totalMemory = RESOURCE_CONSTANTS.BASE_MEMORY + (activeConnections * memoryPerConnection);

  // ネットワーク帯域幅計算
  const networkPerConnection = RESOURCE_CONSTANTS.NETWORK_PER_CONNECTION;
  const totalNetwork = activeConnections * networkPerConnection;

  // 推奨サーバー仕様の算出
  const recommendation = calculateServerRecommendation(totalMemory, totalNetwork);

  return {
    totalMembers,
    estimatedOnlineUsers,
    activeConnections,
    memory: {
      perConnection: memoryPerConnection,
      total: totalMemory,
      formatted: formatMemory(totalMemory)
    },
    network: {
      perConnection: networkPerConnection,
      total: totalNetwork,
      formatted: formatBandwidth(totalNetwork)
    },
    recommendation
  };
}

/**
 * 空のリソース使用量を作成する（メンバー数が0の場合）
 */
function createEmptyResourceUsage(): ResourceUsage {
  return {
    totalMembers: 0,
    estimatedOnlineUsers: 0,
    activeConnections: 0,
    memory: {
      perConnection: 0,
      total: RESOURCE_CONSTANTS.BASE_MEMORY,
      formatted: formatMemory(RESOURCE_CONSTANTS.BASE_MEMORY)
    },
    network: {
      perConnection: 0,
      total: 0,
      formatted: '0 Kbps'
    },
    recommendation: {
      serverType: 'Micro Instance',
      minRam: 1,
      minBandwidth: 1
    }
  };
}

/**
 * リソース使用量に基づいて推奨サーバー仕様を算出する
 */
function calculateServerRecommendation(memory: number, network: number) {
  const ramGB = Math.ceil(memory / 1024); // MBをGBに変換し、切り上げ
  const bandwidthMbps = Math.ceil(network / 1000); // KbpsをMbpsに変換

  // 最小要件の設定
  const minRam = Math.max(ramGB, 1);
  const minBandwidth = Math.max(bandwidthMbps, 1);

  // サーバータイプの決定（RAMベース）
  let serverType: string;
  if (minRam <= 1) {
    serverType = 'Micro Instance';
  } else if (minRam <= 2) {
    serverType = 'Small Instance';
  } else if (minRam <= 4) {
    serverType = 'Medium Instance';
  } else if (minRam <= 8) {
    serverType = 'Large Instance';
  } else if (minRam <= 16) {
    serverType = 'X-Large Instance';
  } else {
    serverType = 'XX-Large Instance or Cluster';
  }

  return {
    serverType,
    minRam,
    minBandwidth
  };
}

/**
 * メモリ使用量をフォーマットする（MB/GB単位）
 */
function formatMemory(memoryMB: number): string {
  if (memoryMB < 1024) {
    return `${Math.round(memoryMB)} MB`;
  } else {
    const memoryGB = memoryMB / 1024;
    return `${Math.round(memoryGB * 100) / 100} GB`;
  }
}

/**
 * 帯域幅をフォーマットする（Kbps/Mbps単位）
 */
function formatBandwidth(bandwidthKbps: number): string {
  if (bandwidthKbps < 1000) {
    return `${bandwidthKbps} Kbps`;
  } else {
    const bandwidthMbps = bandwidthKbps / 1000;
    return `${Math.round(bandwidthMbps * 100) / 100} Mbps`;
  }
}

/**
 * リソース使用量の概要を文字列で取得する
 */
export function getResourceSummary(usage: ResourceUsage): string {
  return `
=== サーバーリソース使用量 ===
総メンバー数: ${usage.totalMembers.toLocaleString()}人
推定オンライン: ${usage.estimatedOnlineUsers.toLocaleString()}人 (${Math.round(RESOURCE_CONSTANTS.ONLINE_RATIO * 100)}%)
アクティブ接続: ${usage.activeConnections.toLocaleString()}接続

メモリ使用量: ${usage.memory.formatted}
ネットワーク帯域: ${usage.network.formatted}

=== 推奨サーバー仕様 ===
サーバータイプ: ${usage.recommendation.serverType}
最小RAM: ${usage.recommendation.minRam}GB
最小帯域幅: ${usage.recommendation.minBandwidth}Mbps
  `.trim();
}

export default calculateResourceCostForEachConnection;
