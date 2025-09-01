/**
 * パスワード強度評価ユーティリティ
 */

export interface PasswordStrengthResult {
  score: number;
  level: 'weak' | 'medium' | 'strong' | 'very_strong';
  suggestions: string[];
}

export interface PasswordValidationResult {
  isValid: boolean;
  message?: string;
}

/**
 * パスワード強度チェッククラス
 */
export class PasswordStrengthChecker {
  
  /**
   * 一般的なパスワードのリスト
   */
  private static readonly COMMON_PASSWORDS = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', '111111', '123123', 'admin', 'letmein',
    'welcome', 'monkey', '1234567890', 'password1', 'iloveyou',
    'princess', 'rockyou', '1234567', '12345678', 'abc123',
    'nicole', 'daniel', 'babygirl', 'monkey', 'lovely',
    'jessica', '654321', 'michael', 'ashley', 'qwerty123'
  ];

  /**
   * パスワード強度スコアを計算
   */
  static calculatePasswordStrength(password: string): PasswordStrengthResult {
    let score = 0;
    const suggestions: string[] = [];

    // 長さチェック
    if (password.length >= 8) {
      score += 1;
    } else {
      suggestions.push('8文字以上にしてください');
    }

    if (password.length >= 12) {
      score += 1;
    } else if (password.length >= 8) {
      suggestions.push('12文字以上にするとより安全です');
    }

    if (password.length >= 16) {
      score += 1;
    }

    // 文字種チェック
    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      suggestions.push('小文字を含めてください');
    }

    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      suggestions.push('大文字を含めてください');
    }

    if (/[0-9]/.test(password)) {
      score += 1;
    } else {
      suggestions.push('数字を含めてください');
    }

    if (/[^a-zA-Z0-9]/.test(password)) {
      score += 2; // 特殊文字は高得点
    } else {
      suggestions.push('記号を含めるとより安全です');
    }

    // 複雑性チェック
    if (password.length > 0 && !this.hasRepeatingChars(password)) {
      score += 1;
    } else if (this.hasRepeatingChars(password)) {
      suggestions.push('連続する同じ文字は避けてください');
    }

    if (password.length > 0 && !this.hasSequentialChars(password)) {
      score += 1;
    } else if (this.hasSequentialChars(password)) {
      suggestions.push('連続する文字列（abc、123など）は避けてください');
    }

    // 一般的なパスワードチェック
    if (!this.isCommonPassword(password)) {
      score += 1;
    } else {
      suggestions.push('このパスワードは一般的すぎます');
      score = Math.max(0, score - 2); // 大幅減点
    }

    // レベル判定
    let level: 'weak' | 'medium' | 'strong' | 'very_strong';
    if (score <= 3) {
      level = 'weak';
    } else if (score <= 6) {
      level = 'medium';
    } else if (score <= 8) {
      level = 'strong';
    } else {
      level = 'very_strong';
    }

    return { score, level, suggestions };
  }

  /**
   * 基本的なパスワード強度バリデーション
   */
  static validatePasswordStrength(password: string): PasswordValidationResult {
    // 最低限の要件：文字と数字を含む
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    if (!hasLetter) {
      return { 
        isValid: false, 
        message: 'パスワードには文字を含める必要があります' 
      };
    }

    if (!hasNumber) {
      return { 
        isValid: false, 
        message: 'パスワードには数字を含める必要があります' 
      };
    }

    return { isValid: true };
  }

  /**
   * 一般的なパスワードかどうかチェック
   */
  static isCommonPassword(password: string): boolean {
    return this.COMMON_PASSWORDS.includes(password.toLowerCase());
  }

  /**
   * 連続する同じ文字があるかチェック
   */
  private static hasRepeatingChars(password: string): boolean {
    for (let i = 0; i < password.length - 2; i++) {
      if (password[i] === password[i + 1] && password[i] === password[i + 2]) {
        return true;
      }
    }
    return false;
  }

  /**
   * 連続する文字列があるかチェック
   */
  private static hasSequentialChars(password: string): boolean {
    const sequences = [
      'abcdefghijklmnopqrstuvwxyz',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      '0123456789',
      'qwertyuiop',
      'asdfghjkl',
      'zxcvbnm'
    ];

    for (const sequence of sequences) {
      for (let i = 0; i <= sequence.length - 3; i++) {
        const substr = sequence.substring(i, i + 3);
        if (password.toLowerCase().includes(substr.toLowerCase())) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * パスワード強度レベルの説明を取得
   */
  static getStrengthDescription(level: PasswordStrengthResult['level']): string {
    switch (level) {
      case 'weak':
        return '弱い - このパスワードは簡単に推測される可能性があります';
      case 'medium':
        return '普通 - まずまずですが、より強化することをお勧めします';
      case 'strong':
        return '強い - 良いパスワードです';
      case 'very_strong':
        return '非常に強い - 優秀なパスワードです';
      default:
        return '不明';
    }
  }

  /**
   * パスワード生成のヒントを取得
   */
  static getPasswordTips(): string[] {
    return [
      '12文字以上の長さにする',
      '大文字と小文字を混在させる',
      '数字を含める',
      '記号を含める',
      '個人情報（名前、誕生日など）を使わない',
      '辞書にある単語をそのまま使わない',
      '他のサイトと同じパスワードを使い回さない',
      '定期的にパスワードを変更する'
    ];
  }

  /**
   * 安全なパスワードの例を生成（参考用）
   */
  static generatePasswordExample(): string {
    const words = ['Coffee', 'Sunset', 'Mountain', 'Ocean', 'Forest'];
    const numbers = ['2024', '123', '456', '789'];
    const symbols = ['!', '@', '#', '$', '&'];

    const word = words[Math.floor(Math.random() * words.length)];
    const number = numbers[Math.floor(Math.random() * numbers.length)];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];

    return `${word}${number}${symbol}`;
  }
}

// 便利な関数をエクスポート
export const calculatePasswordStrength = PasswordStrengthChecker.calculatePasswordStrength;
export const validatePasswordStrength = PasswordStrengthChecker.validatePasswordStrength;
export const isCommonPassword = PasswordStrengthChecker.isCommonPassword;
export const getStrengthDescription = PasswordStrengthChecker.getStrengthDescription;
export const getPasswordTips = PasswordStrengthChecker.getPasswordTips;
export const generatePasswordExample = PasswordStrengthChecker.generatePasswordExample;
