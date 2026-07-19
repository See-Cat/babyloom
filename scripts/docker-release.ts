/// <reference types="node" />
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import readline from 'node:readline';

// ─────────────────────────────────────────────────────────────────────────────
// ANSI
// ─────────────────────────────────────────────────────────────────────────────

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  cyanBold: '\x1b[1;36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
} as const;

function write(s: string): void {
  process.stdout.write(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// 版本计算
// ─────────────────────────────────────────────────────────────────────────────

type BumpKind = 'patch' | 'minor' | 'major';
type ChoiceKind = BumpKind | 'custom';

interface Choice {
  kind: ChoiceKind;
  version: string;
  desc: string;
}

function readCurrentVersion(): string {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version?: string };
  if (!pkg.version) throw new Error('package.json 缺少 version 字段');
  return pkg.version;
}

// 标准 semver bump：解析 x.y.z 三段，抹掉 -beta 等后缀并 bump。
function bump(version: string, kind: BumpKind): string {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!m) throw new Error(`无法解析当前版本号: ${version}`);
  let [x, y, z] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (kind === 'patch') z += 1;
  else if (kind === 'minor') {
    y += 1;
    z = 0;
  } else {
    x += 1;
    y = 0;
    z = 0;
  }
  return `${x}.${y}.${z}`;
}

function buildChoices(current: string): Choice[] {
  return [
    { kind: 'patch', version: bump(current, 'patch'), desc: '修复 / 小改动' },
    { kind: 'minor', version: bump(current, 'minor'), desc: '新增功能（向后兼容）' },
    { kind: 'major', version: bump(current, 'major'), desc: '破坏性变更' },
    { kind: 'custom', version: '手动输入', desc: '预发布 / 跳号等' },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// TUI: 纵向列表
// ─────────────────────────────────────────────────────────────────────────────

function assertTTY(): void {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('此脚本必须在交互终端运行（不支持管道 / CI）。');
  }
}

// 返回 (lines, 文本) — lines 用于清屏，文本用于输出
function composeList(choices: Choice[], selected: number, current: string): string[] {
  const lines: string[] = [];
  lines.push('');
  lines.push(`${ANSI.bold}babyloom 发版工具${ANSI.reset}`);
  lines.push(`${ANSI.dim}当前版本  ${current}${ANSI.reset}`);
  lines.push('');
  lines.push('选择发布版本：');
  lines.push('');
  choices.forEach((c, i) => {
    const isSel = i === selected;
    const cursor = isSel ? `${ANSI.cyanBold}❯${ANSI.reset} ` : '  ';
    const nameStr = (isSel ? `${ANSI.cyanBold}` : '') + c.kind.padEnd(7) + (isSel ? ANSI.reset : '');
    const verStr = (isSel ? `${ANSI.cyan}` : `${ANSI.gray}`) + c.version.padEnd(8) + ANSI.reset;
    const descStr = `${ANSI.gray}${c.desc}${ANSI.reset}`;
    lines.push(`${cursor}${nameStr} ${verStr} ${descStr}`);
  });
  lines.push('');
  lines.push(`${ANSI.dim}↑↓ 选择 · 1-4 直跳 · c 自定义 · Enter 确认 · q 取消${ANSI.reset}`);
  return lines;
}

// 清掉刚才输出的 count 行（count 个 \r\n 已经把光标推到了下面）
// 思路：上移 count 行（CPL 会同时把列归零），然后清屏到屏幕末尾（JED）。
// 这种组合比逐行 2K 稳，因为 JED 会一次性擦掉所有剩余内容，不存在
// 「某行长度变化导致 2K 擦不全 → 旧字符残留」的问题。
function clearLines(count: number): void {
  if (count <= 0) return;
  write(`\x1b[${count}F`); // CPL：先回到列 0 再上移 count 行
  write('\x1b[J'); // JED：从光标清到屏幕末尾
}

// 自定义版本号输入（临时退出 raw mode，用 readline 同步读一行）
function promptCustomVersion(): Promise<string | null> {
  process.stdin.setRawMode(false);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(
      `${ANSI.bold}输入版本号${ANSI.reset}（如 2.1.0 / 2.1.0-beta.1，不带 v）: `,
      (ans) => {
        rl.close();
        const v = ans.trim();
        if (!v) {
          resolve(null);
          return;
        }
        if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/i.test(v)) {
          write(`${ANSI.red}版本号格式不合法: ${v}${ANSI.reset}\n`);
          resolve(null);
          return;
        }
        resolve(v);
      },
    );
  });
}

async function selectVersion(choices: Choice[], current: string): Promise<Choice | null> {
  assertTTY();

  let selected = 0; // 默认 patch
  let displayed = composeList(choices, selected, current);
  // 用 \r\n 行结尾，避免不同终端对裸 \n 的解释差异。
  write(displayed.join('\r\n') + '\r\n');

  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.setEncoding('utf8');
  stdin.resume();

  // 事件监听引用（removeListener 时用）
  let onData: ((chunk: string) => void) | null = null;
  let onSigInt: (() => void) | null = null;

  const repaint = () => {
    // 上次输出了 displayed.length 个 \r\n，光标被推下了 displayed.length 行。
    clearLines(displayed.length);
    displayed = composeList(choices, selected, current);
    write(displayed.join('\r\n') + '\r\n');
  };

  // raw mode 监听
  const startRaw = (resolveFn: (r: Choice | null) => void) => {
    const cleanup = () => {
      try {
        stdin.setRawMode(false);
      } catch {
        /* 已关 */
      }
      stdin.pause();
      if (onData) stdin.removeListener('data', onData);
      if (onSigInt) process.removeListener('SIGINT', onSigInt);
      onData = null;
      onSigInt = null;
    };
    const finish = (result: Choice | null) => {
      cleanup();
      clearLines(displayed.length);
      resolveFn(result);
    };
    const enterCustom = async () => {
      cleanup();
      clearLines(displayed.length);
      const v = await promptCustomVersion();
      if (!v) {
        // 取消/非法 → 重开选择界面
        displayed = composeList(choices, selected, current);
        write(displayed.join('\r\n') + '\r\n');
        stdin.setRawMode(true);
        stdin.resume();
        startRaw(resolveFn);
      } else {
        finish({ kind: 'custom', version: v, desc: '自定义版本' });
      }
    };
    onData = (chunk: string) => {
      const k = chunk;
      if (k === '\u001b[B' || k === 'j') {
        selected = (selected + 1) % choices.length;
        repaint();
      } else if (k === '\u001b[A' || k === 'k') {
        selected = (selected - 1 + choices.length) % choices.length;
        repaint();
      } else if (k >= '1' && k <= String(choices.length)) {
        selected = Number(k) - 1;
        repaint();
      } else if (k === 'c' || k === 'C') {
        void enterCustom();
      } else if (k === '\r' || k === '\n') {
        const c = choices[selected];
        if (c.kind === 'custom') {
          void enterCustom();
        } else {
          finish(c);
        }
      } else if (k === 'q' || k === 'Q' || k === '\u001b' || k === '\u0003') {
        finish(null);
      }
    };
    onSigInt = () => finish(null);
    stdin.on('data', onData);
    process.on('SIGINT', onSigInt);
  };

  return new Promise<Choice | null>((resolve) => startRaw(resolve));
}

// ─────────────────────────────────────────────────────────────────────────────
// 二次确认
// ─────────────────────────────────────────────────────────────────────────────

function confirmRun(version: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    write('\n');
    write(`${ANSI.bold}即将执行：${ANSI.reset}\n`);
    write(
      `  ${ANSI.cyan}1)${ANSI.reset} pnpm version ${version}      ${ANSI.gray}（更新 package.json + git commit + tag v${version}）${ANSI.reset}\n`,
    );
    write(
      `  ${ANSI.cyan}2)${ANSI.reset} pnpm docker:push             ${ANSI.gray}（构建并推送 :${version} 和 :latest）${ANSI.reset}\n`,
    );
    write('\n');
    rl.question(`${ANSI.bold}继续？${ANSI.reset} [y/N] `, (ans) => {
      rl.close();
      resolve(/^y(es)?$/i.test(ans.trim()));
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 执行
// ─────────────────────────────────────────────────────────────────────────────

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} 退出码 ${code}`));
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const current = readCurrentVersion();
  const choices = buildChoices(current);

  const choice = await selectVersion(choices, current);
  if (!choice) {
    write(`${ANSI.yellow}已取消。${ANSI.reset}\n`);
    return;
  }

  const ok = await confirmRun(choice.version);
  if (!ok) {
    write(`${ANSI.yellow}已取消。${ANSI.reset}\n`);
    return;
  }

  // 1) pnpm version <selected>（默认会 commit + tag vX.Y.Z）
  write(`\n${ANSI.dim}› pnpm version ${choice.version}${ANSI.reset}\n`);
  try {
    await run('pnpm', ['version', choice.version]);
  } catch (e) {
    write(`${ANSI.red}pnpm version 失败，package.json 未被修改（或已被回滚）。${ANSI.reset}\n`);
    throw e;
  }

  // 2) pnpm docker:push
  write(`\n${ANSI.dim}› pnpm docker:push${ANSI.reset}\n`);
  try {
    await run('pnpm', ['docker:push']);
  } catch (e) {
    write(`\n${ANSI.red}镜像推送失败。${ANSI.reset}\n`);
    write(
      `${ANSI.yellow}如需回退版本提交：${ANSI.reset}\n  git reset --hard HEAD~1 && git tag -d v${choice.version}\n`,
    );
    throw e;
  }

  write(`\n${ANSI.green}✓ 发布完成：v${choice.version}${ANSI.reset}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
