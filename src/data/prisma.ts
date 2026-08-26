import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { DomainError } from "@/src/domain/errors";
import { runtimeConfig } from "@/src/config/runtime";

const globalForPrisma = globalThis as unknown as { privacyPolicyPrisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (globalForPrisma.privacyPolicyPrisma) return globalForPrisma.privacyPolicyPrisma;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new DomainError("DATABASE_UNAVAILABLE", "尚未配置本地 MySQL 连接。", { retryable: true });
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new DomainError("DATABASE_UNAVAILABLE", "本地 MySQL 连接配置无效。", { retryable: true });
  }

  if (url.protocol !== "mysql:" && url.protocol !== "mariadb:") {
    throw new DomainError("DATABASE_UNAVAILABLE", "仅支持项目兼容的 MySQL 8 连接。", { retryable: true });
  }

  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "") || undefined,
    connectionLimit: runtimeConfig.databaseConnectionLimit,
    acquireTimeout: runtimeConfig.databaseAcquireTimeoutMs,
    allowPublicKeyRetrieval: true,
  });
  const client = new PrismaClient({ adapter });
  // 单例在所有环境都缓存到 globalThis（标准 Next.js 模式），避免每次请求新建连接池导致泄漏。
  globalForPrisma.privacyPolicyPrisma = client;
  return client;
}
