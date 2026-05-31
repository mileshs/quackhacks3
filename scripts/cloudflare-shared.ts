import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type RunOptions = {
  allowFailure?: boolean;
  capture?: boolean;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

export const scriptDir = dirname(fileURLToPath(import.meta.url));
export const rootDir = resolve(scriptDir, "..");
export const wranglerPath = resolve(rootDir, "wrangler.jsonc");
export const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "a95007cb065e2bfced646f55bfc5dd35";
export const workerName = process.env.CLOUDFLARE_WORKER_NAME ?? "quackhacks3";
export const databaseName = process.env.CLOUDFLARE_D1_DATABASE_NAME ?? "quackhacks3";

export type WranglerConfig = {
  account_id?: string;
  name: string;
  d1_databases: Array<{
    binding: string;
    database_name: string;
    database_id: string;
    migrations_dir?: string;
  }>;
};

export function run(command: string, args: string[], options: RunOptions = {}) {
  const [spawnCommand, spawnArgs] =
    process.platform === "win32"
      ? [
          process.env.ComSpec ?? "cmd.exe",
          ["/d", "/s", "/c", [command, ...args].map(quoteShellArg).join(" ")]
        ]
      : [command, args];

  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd: options.cwd ?? rootDir,
    env: {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: accountId,
      ...options.env
    },
    encoding: "utf8",
    shell: false,
    stdio: options.capture ? "pipe" : "inherit"
  });

  if (result.error && !options.allowFailure) {
    throw result.error;
  }

  if (result.status !== 0 && !options.allowFailure) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(output || `${command} ${args.join(" ")} failed`);
  }

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function quoteShellArg(arg: string) {
  if (/^[A-Za-z0-9_@%+=:,./\\#-]+$/.test(arg)) {
    return arg;
  }

  return `"${arg.replaceAll('"', '\\"')}"`;
}

export function pnpm(args: string[], options?: RunOptions) {
  if (process.env.npm_execpath) {
    if (process.env.npm_execpath.endsWith(".js") || process.env.npm_execpath.endsWith(".cjs")) {
      return run(process.execPath, [process.env.npm_execpath, ...args], options);
    }

    return run(process.env.npm_execpath, args, options);
  }

  return run("pnpm", args, options);
}

export function wrangler(args: string[], options?: RunOptions) {
  return pnpm(["exec", "wrangler", ...args], options);
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function extractJson<T>(output: string): T {
  const text = output.trim();
  const starts = [text.indexOf("{"), text.indexOf("[")].filter((index) => index >= 0);
  if (starts.length === 0) {
    throw new Error(`No JSON found in output:\n${output}`);
  }

  const start = Math.min(...starts);
  const candidates: string[] = [];
  for (const endChar of ["}", "]"]) {
    const end = text.lastIndexOf(endChar);
    if (end > start) {
      candidates.push(text.slice(start, end + 1));
    }
  }

  for (const candidate of candidates.sort((a, b) => b.length - a.length)) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Try the next plausible JSON span.
    }
  }

  throw new Error(`Could not parse JSON from output:\n${output}`);
}
