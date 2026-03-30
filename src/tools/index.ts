/**
 * Tool 注册中心
 * 收集所有 tool 模块的定义和 handler，统一注册到 Hub
 *
 * handler 内部通过 getCurrentClient() 获取当前 installation 对应的 AliyunClient，
 * 实现 per-installation 凭证隔离。
 */
import { getCurrentClient } from "../aliyun/client.js";
import type { AliyunClient } from "../aliyun/client.js";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";

/** Tool 模块接口 */
export interface ToolModule {
  definitions: ToolDefinition[];
  createHandlers: (client: AliyunClient) => Map<string, ToolHandler>;
}

// 导入各 tool 模块
import { ecsTools } from "./ecs.js";
import { dnsTools } from "./dns.js";
import { cdnTools } from "./cdn.js";
import { sslTools } from "./ssl.js";
import { slbTools } from "./slb.js";
import { securityTools } from "./security.js";
import { billingTools } from "./billing.js";
import { vpcTools } from "./vpc.js";
import { rdsTools } from "./rds.js";
import { redisTools } from "./redis.js";
import { domainTools } from "./domain.js";

/** 所有 tool 模块列表 */
const modules: ToolModule[] = [
  ecsTools,
  dnsTools,
  cdnTools,
  sslTools,
  slbTools,
  securityTools,
  billingTools,
  vpcTools,
  rdsTools,
  redisTools,
  domainTools,
];

/**
 * 创建一个代理 AliyunClient，所有方法调用都委托给 getCurrentClient()。
 * 这样 tool handler 中闭包捕获的 client 实际会动态解析到当前 installation 的客户端。
 */
function createClientProxy(): AliyunClient {
  return new Proxy({} as AliyunClient, {
    get(_target, prop, _receiver) {
      const real = getCurrentClient();
      const value = (real as any)[prop];
      if (typeof value === "function") {
        return value.bind(real);
      }
      return value;
    },
  });
}

/**
 * 收集所有 tool 的定义和处理函数
 * @returns definitions: 全部 tool 定义列表, handlers: 命令名 → 处理函数映射
 */
export function collectAllTools(): {
  definitions: ToolDefinition[];
  handlers: Map<string, ToolHandler>;
} {
  // 使用代理客户端，handler 执行时动态解析到当前 installation 的客户端
  const proxy = createClientProxy();

  const definitions: ToolDefinition[] = [];
  const handlers = new Map<string, ToolHandler>();

  for (const mod of modules) {
    // 收集定义
    definitions.push(...mod.definitions);

    // 收集处理函数（传入代理客户端）
    const modHandlers = mod.createHandlers(proxy);
    for (const [name, handler] of modHandlers) {
      if (handlers.has(name)) {
        console.warn(`[tools] 工具名称冲突: ${name}，后者将覆盖前者`);
      }
      handlers.set(name, handler);
    }
  }

  console.log(`[tools] 共注册 ${definitions.length} 个工具, ${handlers.size} 个处理函数`);
  return { definitions, handlers };
}
