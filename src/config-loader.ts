import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as yaml from "js-yaml";
import { z } from "zod";
import { printInfo, printWarning, printError } from "./utils";
import { ConfigSchema, Config, DEFAULT_CONFIG } from "./config-schema";

const CONFIG_FILE = "config.yaml";
const CONFIG_DIR = path.join(os.homedir(), ".code-container");
const CONFIG_PATH = path.join(CONFIG_DIR, CONFIG_FILE);

export function loadConfig(): Config {
  if (!fs.existsSync(CONFIG_PATH)) {
    return applyEnvOverrides(DEFAULT_CONFIG);
  }

  try {
    const content = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = yaml.load(content) as any;

    if (!parsed || typeof parsed !== "object") {
      printWarning("Invalid config.yaml format");
      return applyEnvOverrides(DEFAULT_CONFIG);
    }

    // Expand ~ in base_dir
    if (parsed.base_dir && typeof parsed.base_dir === "string") {
      parsed.base_dir = parsed.base_dir.replace(/^~/, os.homedir());
    }

    const config = ConfigSchema.parse(parsed);
    return applyEnvOverrides(config);
  } catch (error) {
    printWarning(`Failed to load config.yaml: ${error}`);
    printWarning("Using default configuration");
    return applyEnvOverrides(DEFAULT_CONFIG);
  }
}

/**
 * Apply environment variable overrides to config
 * Priority: Env Vars > Config File > Defaults
 */
function applyEnvOverrides(config: Config): Config {
  const overrides: Partial<Config> = {};

  // CONTAINER_AUTO_STOP: true/false
  if (process.env.CONTAINER_AUTO_STOP !== undefined) {
    const boolValue = process.env.CONTAINER_AUTO_STOP.toLowerCase() === "true";
    overrides.auto_stop = boolValue;
  }

  // CONTAINER_BASE_DIR: path
  if (process.env.CONTAINER_BASE_DIR) {
    overrides.base_dir = process.env.CONTAINER_BASE_DIR;
  }

  return { ...config, ...overrides };
}

export function saveConfig(config: Config): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }

  const yamlContent = yaml.dump(config, {
    indent: 2,
    lineWidth: 100,
  });

  fs.writeFileSync(CONFIG_PATH, yamlContent, { mode: 0o600 });
  printInfo(`Configuration saved to ${CONFIG_PATH}`);
}

export function getConfigDir(): string {
  const config = loadConfig();
  return config.base_dir;
}

export function getMounts(): string[] {
  const config = loadConfig();
  const mounts: string[] = [];

  // Process each mount entry
  for (const mount of config.mounts) {
    // Skip disabled mounts
    if (mount.enabled === false) {
      continue;
    }

    // 使用 config_path 作为挂载源（不是 source）
    let mountSource = mount.config_path;

    // Expand ${base_dir} variable
    if (mountSource.includes("${base_dir}")) {
      const baseDir = config.base_dir;
      if (baseDir.startsWith("~/")) {
        mountSource = mountSource.replace("${base_dir}", path.join(os.homedir(), baseDir.substring(2)));
      } else {
        mountSource = mountSource.replace("${base_dir}", baseDir);
      }
    } else if (mountSource.startsWith("~/")) {
      // Expand ~ in config_path
      mountSource = path.join(os.homedir(), mountSource.substring(2));
    }

    // Build mount string
    let mountStr = `${mountSource}:${mount.dest}`;
    if (mount.readonly) {
      mountStr += ":ro";
    }
    mounts.push(mountStr);
  }

  return mounts;
}

export function createDefaultConfig(): void {
  if (fs.existsSync(CONFIG_PATH)) {
    printWarning(`Config file already exists: ${CONFIG_PATH}`);
    return;
  }

  const defaultConfig: Config = {
    base_dir: "~/.code-container",
    auto_stop: true,
    mounts: [
      // AI/Code Assistant Configs
      // source: init 时复制的源路径（可选，为空则跳过复制）
      // config_path: base_dir 中的存储路径（运行时挂载此路径）
      // dest: 容器内的挂载点
      // enabled: false 可禁用某个挂载
      {
        name: "claude",
        source: "~/.claude",
        config_path: "${base_dir}/configs/.claude",
        dest: "/root/.claude",
        readonly: false,
        enabled: true,
      },
      {
        name: "claude-json",
        source: "~/.claude.json",
        config_path: "${base_dir}/configs/.claude.json",
        dest: "/root/.claude.json",
        readonly: false,
        enabled: true,
      },
      {
        name: "codex",
        source: "~/.codex",
        config_path: "${base_dir}/configs/.codex",
        dest: "/root/.codex",
        readonly: false,
        enabled: true,
      },
      {
        name: "copilot",
        source: "~/.copilot",
        config_path: "${base_dir}/configs/.copilot",
        dest: "/root/.copilot",
        readonly: false,
        enabled: true,
      },
      {
        name: "gemini",
        source: "~/.gemini",
        config_path: "${base_dir}/configs/.gemini",
        dest: "/root/.gemini",
        readonly: false,
        enabled: true,
      },
      {
        name: "opencode",
        source: "~/.config/opencode",
        config_path: "${base_dir}/configs/.opencode",
        dest: "/root/.config/opencode",
        readonly: false,
        enabled: true,
      },
      // System Configs
      {
        name: "gitconfig",
        config_path: "~/.gitconfig",
        dest: "/root/.gitconfig",
        readonly: true,
        enabled: true,
      },
      {
        name: "local-share",
        config_path: "${base_dir}/configs/.local",
        dest: "/root/.local",
        readonly: false,
        enabled: true,
      },
    ],
  };

  saveConfig(defaultConfig);

  printInfo("");
  printInfo("Created default config.yaml");
  printInfo("Edit this file to customize your container configuration");
  printInfo(`  ${CONFIG_PATH}`);
}

export function ensureConfigDir(): string {
  const config = loadConfig();
  let baseDir = config.base_dir;

  // Expand ~ if present
  if (baseDir.startsWith("~/")) {
    baseDir = path.join(os.homedir(), baseDir.substring(2));
  }

  // Create base directory
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true, mode: 0o700 });
  }

  return baseDir;
}

/**
 * 根据 config.yaml 配置复制配置文件
 * 从 source 复制到 config_path
 */
export function copyConfigsFromYaml(): void {
  const config = loadConfig();
  const baseDir = ensureConfigDir();

  // Process each mount entry
  for (const mount of config.mounts) {
    // Skip disabled mounts or mounts without source
    if (mount.enabled === false || !mount.source) {
      continue;
    }

    // Expand source path
    let sourcePath = mount.source;
    if (sourcePath.startsWith("~/")) {
      sourcePath = path.join(os.homedir(), sourcePath.substring(2));
    }

    // Expand config_path
    let targetPath = mount.config_path;
    if (targetPath.includes("${base_dir}")) {
      if (baseDir.startsWith("~/")) {
        targetPath = targetPath.replace("${base_dir}", baseDir);
      } else {
        targetPath = targetPath.replace("${base_dir}", baseDir);
      }
    } else if (targetPath.startsWith("~/")) {
      targetPath = path.join(os.homedir(), targetPath.substring(2));
    }

    // Check if source exists
    if (!fs.existsSync(sourcePath)) {
      printWarning(`Source path does not exist: ${sourcePath}`);
      continue;
    }

    // Create target directory if needed
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true, mode: 0o700 });
    }

    // Copy file/directory
    try {
      const stat = fs.statSync(sourcePath);
      if (stat.isDirectory()) {
        if (fs.existsSync(targetPath)) {
          fs.rmSync(targetPath, { recursive: true, force: true });
        }
        fs.cpSync(sourcePath, targetPath, { recursive: true });
        printInfo(`Copied directory: ${sourcePath} -> ${targetPath}`);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
        printInfo(`Copied file: ${sourcePath} -> ${targetPath}`);
      }
    } catch (error) {
      printWarning(`Failed to copy ${sourcePath} to ${targetPath}: ${error}`);
    }
  }
}
