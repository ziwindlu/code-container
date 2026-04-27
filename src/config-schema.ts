import { z } from "zod";

// Mount entry schema
export const MountEntrySchema = z.object({
  name: z.string().optional(),
  // init 时从 source 复制到 config_path
  source: z.string().optional(),
  // 配置在 base_dir 中的存储路径（运行时挂载此路径）
  config_path: z.string(),
  // 容器内的挂载点
  dest: z.string(),
  readonly: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

export type MountEntry = z.infer<typeof MountEntrySchema>;

// Configuration schema for ~/.code-container/config.yaml
export const ConfigSchema = z.object({
  // Base directory for configs (default: ~/.code-container)
  // Used as ${base_dir} in source paths
  base_dir: z.string().default("~/.code-container"),

  // Auto-stop container on exit (default: true)
  // false: container stays running after exit (like -d for all sessions)
  // true: container stops on exit unless -d flag is used
  auto_stop: z.boolean().default(true),

  // All mounts (completely customizable)
  mounts: z.array(MountEntrySchema).default([
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
  ]),
}).default({
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
});

export type Config = z.infer<typeof ConfigSchema>;

export const DEFAULT_CONFIG: Config = {
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
