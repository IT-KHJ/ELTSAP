/**
 * SAP SQL Server 접속 설정 (읽기 전용 접속 정보).
 * neelt 백엔드(pyodbc) 연동 방식에 맞춤: 서버\인스턴스 형식, TrustServerCertificate 기본 true.
 * 실제 SAP 조회는 SAP 원본 미러 동기화(scripts/sap-mirror)에서만 수행한다.
 */

export interface SapSqlConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  port?: number;
  instanceName?: string;
  options?: {
    encrypt?: boolean;
    trustServerCertificate?: boolean;
    enableArithAbort?: boolean;
  };
}

const DEFAULT_PORT = 1433;

/** SAP_SQL_SERVER에 "호스트\인스턴스" 형식이면 분리. neelt와 동일하게 인스턴스 사용 시 port 미사용 */
function parseServer(serverRaw: string): { server: string; instanceName?: string; usePort: boolean } {
  const s = serverRaw.trim();
  if (s.includes("\\")) {
    const [server, instanceName] = s.split("\\").map((x) => x.trim()).filter(Boolean);
    return { server: server ?? s, instanceName: instanceName || undefined, usePort: false };
  }
  return { server: s, usePort: true };
}

export function getSapSqlConfig(): SapSqlConfig | null {
  const serverRaw = process.env.SAP_SQL_SERVER;
  const database = process.env.SAP_SQL_DATABASE;
  const user = process.env.SAP_SQL_USER;
  const password = process.env.SAP_SQL_PASSWORD;
  if (!serverRaw || !database || !user || !password) return null;
  const { server, instanceName, usePort } = parseServer(serverRaw);
  const portEnv = process.env.SAP_SQL_PORT;
  const port = portEnv ? parseInt(portEnv, 10) : DEFAULT_PORT;
  const explicitInstance = process.env.SAP_SQL_INSTANCE?.trim();
  const trustCert = process.env.SAP_SQL_TRUST_CERT !== "false";
  // 원격 IP 접속 시 Encrypt=true면 TLS 단계에서 socket hang up 발생 가능 → 기본 비암호화
  const encrypt = process.env.SAP_SQL_ENCRYPT === "true";
  return {
    server,
    database,
    user,
    password,
    port: usePort && !Number.isNaN(port) ? port : undefined,
    instanceName: explicitInstance || instanceName,
    options: {
      encrypt,
      trustServerCertificate: trustCert,
      enableArithAbort: true,
    },
  };
}
