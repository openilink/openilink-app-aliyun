/**
 * AliyunClient 测试
 * 验证签名算法和请求构造逻辑
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AliyunClient } from "../src/aliyun/client.js";

describe("AliyunClient", () => {
  let client: AliyunClient;

  beforeEach(() => {
    client = new AliyunClient("testAccessKeyId", "testAccessKeySecret", "cn-hangzhou");
  });

  it("getRegion 应返回构造时传入的区域", () => {
    expect(client.getRegion()).toBe("cn-hangzhou");
  });

  it("request 应构造正确的请求 URL 并发送请求", async () => {
    // Mock fetch
    const mockResponse = {
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        Instances: { Instance: [] },
      })),
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as any);

    const result = await client.request("ecs.aliyuncs.com", "DescribeInstances", {
      PageSize: "10",
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    // 验证请求 URL 包含必要参数
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain("ecs.aliyuncs.com");
    expect(calledUrl).toContain("Action=DescribeInstances");
    expect(calledUrl).toContain("AccessKeyId=testAccessKeyId");
    expect(calledUrl).toContain("SignatureMethod=HMAC-SHA1");
    expect(calledUrl).toContain("Signature=");
    expect(calledUrl).toContain("PageSize=10");

    expect(result.Instances.Instance).toEqual([]);

    fetchSpy.mockRestore();
  });

  it("request POST 方法应使用 form body", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({ RequestId: "test-123" })),
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as any);

    await client.request("ecs.aliyuncs.com", "StartInstance", {
      InstanceId: "i-test123",
    }, "POST");

    expect(fetchSpy).toHaveBeenCalledOnce();
    const options = fetchSpy.mock.calls[0][1] as any;
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(options.body).toContain("Action=StartInstance");
    expect(options.body).toContain("InstanceId=i-test123");

    fetchSpy.mockRestore();
  });

  it("API 返回错误时应抛出异常", async () => {
    const mockResponse = {
      ok: false,
      status: 403,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        Code: "Forbidden.RAM",
        Message: "User not authorized to operate",
      })),
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as any);

    await expect(
      client.request("ecs.aliyuncs.com", "DescribeInstances"),
    ).rejects.toThrow("阿里云 API 错误 [403]");

    vi.restoreAllMocks();
  });

  it("签名结果应在不同 nonce/timestamp 时不同", async () => {
    const urls: string[] = [];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      urls.push(url as string);
      return {
        ok: true,
        status: 200,
        text: async () => "{}",
      } as any;
    });

    await client.request("ecs.aliyuncs.com", "DescribeInstances");
    await client.request("ecs.aliyuncs.com", "DescribeInstances");

    // 由于 SignatureNonce 和 Timestamp 不同，URL 应不同
    expect(urls[0]).not.toBe(urls[1]);

    fetchSpy.mockRestore();
  });
});
