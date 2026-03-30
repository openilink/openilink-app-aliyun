/**
 * 阿里云 OpenAPI 客户端
 *
 * 实现阿里云 RPC 风格 API 的签名和调用。
 * 签名算法：阿里云签名机制 V1（HMAC-SHA1），适用于绝大多数 RPC 风格的 API。
 *
 * 签名流程：
 * 1. 构造规范化请求字符串（按参数名 ASCII 排序）
 * 2. 构造待签名字符串 = HTTPMethod + "&" + encode("/") + "&" + encode(规范化请求字符串)
 * 3. 使用 HMAC-SHA1 计算签名，密钥为 AccessKeySecret + "&"
 */

import { createHmac, randomUUID } from "node:crypto";

/** 当前请求使用的 AliyunClient 实例（per-installation 凭证隔离） */
let _currentClient: AliyunClient;

/** 设置当前请求的 AliyunClient */
export function setCurrentClient(c: AliyunClient): void {
  _currentClient = c;
}

/** 获取当前请求的 AliyunClient */
export function getCurrentClient(): AliyunClient {
  return _currentClient;
}

export class AliyunClient {
  private accessKeyId: string;
  private accessKeySecret: string;
  private region: string;

  constructor(accessKeyId: string, accessKeySecret: string, region: string) {
    this.accessKeyId = accessKeyId;
    this.accessKeySecret = accessKeySecret;
    this.region = region;
  }

  /** 获取默认区域 */
  getRegion(): string {
    return this.region;
  }

  /**
   * 通用 RPC 风格请求方法
   * @param endpoint 服务端点，如 "ecs.aliyuncs.com"
   * @param action API 操作名称，如 "DescribeInstances"
   * @param params 额外请求参数
   * @param method HTTP 方法，默认 "GET"
   * @returns API 响应 JSON
   */
  async request(
    endpoint: string,
    action: string,
    params?: Record<string, string>,
    method: string = "GET",
  ): Promise<any> {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const nonce = randomUUID();

    // 公共参数
    const commonParams: Record<string, string> = {
      Action: action,
      Version: this.getApiVersion(endpoint),
      Format: "JSON",
      AccessKeyId: this.accessKeyId,
      SignatureMethod: "HMAC-SHA1",
      Timestamp: timestamp,
      SignatureVersion: "1.0",
      SignatureNonce: nonce,
      RegionId: this.region,
    };

    // 合并业务参数
    const allParams: Record<string, string> = { ...commonParams, ...params };

    // 计算签名
    const signature = this.sign(method, allParams);
    allParams.Signature = signature;

    // 构造请求
    const url = `https://${endpoint}`;
    let response: Response;

    if (method === "GET") {
      const qs = new URLSearchParams(allParams).toString();
      response = await fetch(`${url}?${qs}`, {
        method: "GET",
        signal: AbortSignal.timeout(30_000),
      });
    } else {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(allParams).toString(),
        signal: AbortSignal.timeout(30_000),
      });
    }

    const text = await response.text();

    if (!response.ok) {
      let errMsg: string;
      try {
        const errJson = JSON.parse(text);
        errMsg = errJson.Message || errJson.Code || text;
      } catch {
        errMsg = text;
      }
      throw new Error(`阿里云 API 错误 [${response.status}]: ${errMsg}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  /**
   * 阿里云签名计算（V1 签名，HMAC-SHA1）
   * @param method HTTP 方法
   * @param params 所有请求参数（不含 Signature）
   * @returns base64 编码的签名字符串
   */
  private sign(method: string, params: Record<string, string>): string {
    // 1. 按参数名 ASCII 排序
    const sortedKeys = Object.keys(params).sort();

    // 2. 构造规范化查询字符串
    const canonicalQuery = sortedKeys
      .map((key) => `${this.percentEncode(key)}=${this.percentEncode(params[key])}`)
      .join("&");

    // 3. 构造待签名字符串
    const stringToSign = `${method}&${this.percentEncode("/")}&${this.percentEncode(canonicalQuery)}`;

    // 4. 计算 HMAC-SHA1 签名，密钥为 AccessKeySecret + "&"
    const hmac = createHmac("sha1", this.accessKeySecret + "&");
    hmac.update(stringToSign);
    return hmac.digest("base64");
  }

  /**
   * 阿里云特殊的 URL 编码（RFC 3986）
   * 与标准 encodeURIComponent 的区别：
   * - 空格编码为 %20（而非 +）
   * - 星号 * 编码为 %2A
   * - 波浪号 ~ 不编码
   */
  private percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/\+/g, "%20")
      .replace(/\*/g, "%2A")
      .replace(/%7E/g, "~");
  }

  /**
   * 根据 endpoint 返回对应的 API 版本号
   * 阿里云不同服务的 API 版本不同
   */
  private getApiVersion(endpoint: string): string {
    const versionMap: Record<string, string> = {
      "ecs.aliyuncs.com": "2014-05-26",
      "alidns.aliyuncs.com": "2015-01-09",
      "cdn.aliyuncs.com": "2018-05-10",
      "cas.aliyuncs.com": "2020-04-07",
      "slb.aliyuncs.com": "2014-05-15",
      "business.aliyuncs.com": "2017-12-14",
      "bssopenapi.aliyuncs.com": "2017-12-14",
      "vpc.aliyuncs.com": "2016-04-28",
      "rds.aliyuncs.com": "2014-08-15",
      "r-kvstore.aliyuncs.com": "2015-01-01",
      "domain.aliyuncs.com": "2018-01-29",
    };

    // 尝试精确匹配
    if (versionMap[endpoint]) {
      return versionMap[endpoint];
    }

    // 尝试前缀匹配（如 ecs.cn-hangzhou.aliyuncs.com）
    for (const [key, version] of Object.entries(versionMap)) {
      const prefix = key.split(".")[0];
      if (endpoint.startsWith(prefix + ".")) {
        return version;
      }
    }

    // 默认版本
    return "2014-05-26";
  }
}
