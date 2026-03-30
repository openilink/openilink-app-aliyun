/**
 * utils/crypto.ts 测试
 * 验证签名验证和 PKCE 生成
 */
import { describe, it, expect } from "vitest";
import { verifySignature, generatePKCE } from "../../src/utils/crypto.js";
import { createHmac } from "node:crypto";

describe("verifySignature", () => {
  const secret = "test-secret";
  const timestamp = "1700000000";
  const body = Buffer.from('{"action": "test"}');

  function computeSignature(): string {
    const mac = createHmac("sha256", secret);
    mac.update(timestamp + ":");
    mac.update(body);
    return "sha256=" + mac.digest("hex");
  }

  it("正确的签名应验证通过", () => {
    expect(verifySignature(secret, timestamp, body, computeSignature())).toBe(true);
  });

  it("错误的签名应验证失败", () => {
    expect(verifySignature(secret, timestamp, body, "sha256=wrong")).toBe(false);
  });
});

describe("generatePKCE", () => {
  it("应生成有效的 verifier 和 challenge", () => {
    const { verifier, challenge } = generatePKCE();
    expect(verifier).toBeTruthy();
    expect(challenge).toBeTruthy();
    // base64url 编码不应包含 + / =
    expect(verifier).not.toMatch(/[+/=]/);
    expect(challenge).not.toMatch(/[+/=]/);
  });

  it("每次生成应不同", () => {
    const a = generatePKCE();
    const b = generatePKCE();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.challenge).not.toBe(b.challenge);
  });
});
