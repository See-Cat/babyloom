import { rmSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';

export default async function globalSetup() {
  const dir = resolve(process.cwd(), 'test-data/e2e');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    `${dir}/config.yaml`,
    `owner:
  username: e2eowner
  password: e2epassword
  nickname: E2E Owner
family:
  name: E2E Family
app:
  baseUrl: http://localhost:3000
  timezone: Asia/Shanghai
  secret: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd
log:
  level: warn
`,
    'utf-8'
  );
  chmodSync(`${dir}/config.yaml`, 0o600);
}
