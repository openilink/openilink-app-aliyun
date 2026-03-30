/**
 * 应用配置 - 从环境变量加载
 */
export interface Config {
  /** HTTP 监听端口 */
  port: string;
  /** OpeniLink Hub 地址 */
  hubUrl: string;
  /** 本 App 的公网地址 */
  baseUrl: string;
  /** SQLite 数据库路径 */
  dbPath: string;
  /** 阿里云 AccessKey ID（必填） */
  aliyunAccessKeyId: string;
  /** 阿里云 AccessKey Secret（必填） */
  aliyunAccessKeySecret: string;
  /** 阿里云默认区域 */
  aliyunRegion: string;
}

function env(key: string, fallback = ""): string {
  return process.env[key] || fallback;
}

export function loadConfig(): Config {
  const cfg: Config = {
    port: env("PORT", "8100"),
    hubUrl: env("HUB_URL"),
    baseUrl: env("BASE_URL"),
    dbPath: env("DB_PATH", "data/aliyun.db"),
    aliyunAccessKeyId: env("ALIYUN_ACCESS_KEY_ID"),
    aliyunAccessKeySecret: env("ALIYUN_ACCESS_KEY_SECRET"),
    aliyunRegion: env("ALIYUN_REGION", "cn-hangzhou"),
  };

  const missing: string[] = [];
  if (!cfg.hubUrl) missing.push("HUB_URL");
  if (!cfg.baseUrl) missing.push("BASE_URL");
  if (!cfg.aliyunAccessKeyId) missing.push("ALIYUN_ACCESS_KEY_ID");
  if (!cfg.aliyunAccessKeySecret) missing.push("ALIYUN_ACCESS_KEY_SECRET");

  if (missing.length > 0) {
    throw new Error(`缺少必填环境变量: ${missing.join(", ")}`);
  }

  return cfg;
}
