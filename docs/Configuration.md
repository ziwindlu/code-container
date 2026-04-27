# Configuration Guide

## Overview

`container` 支持三层配置体系，优先级从高到低为：

**环境变量 > 命令行参数 > 配置文件 (config.yaml)**

## Configuration Priority

```
Environment Variables (Highest)
         ↓
   Command-line Flags
         ↓
   config.yaml (Lowest)
         ↓
   Default Values
```

### Example: `auto_stop` Configuration

```bash
# config.yaml: auto_stop: true

# Case 1: Use config.yaml value
container run              # Auto-stops (uses config.yaml: true)

# Case 2: Environment variable overrides config.yaml
CONTAINER_AUTO_STOP=false container run    # No auto-stop (env overrides config)

# Case 3: Command-line flag has highest priority
CONTAINER_AUTO_STOP=false container run -d # No auto-stop (-d highest)
container run -d                           # No auto-stop (regardless of config)
```

## Configuration Options

### `auto_stop`

Controls whether to automatically stop the container after the session ends.

| Type | Default |
|------|---------|
| boolean | `true` |

**Configuration Methods:**

| Method | Syntax | Example |
|--------|--------|---------|
| **config.yaml** | `auto_stop: boolean` | `auto_stop: false` |
| **Environment Variable** | `CONTAINER_AUTO_STOP=true\|false` | `CONTAINER_AUTO_STOP=false` |
| **Command-line Flag** | `-d` | `container run -d` |

**Behavior:**
- `true`: Container stops automatically after session ends
- `false`: Container keeps running after session ends

**Notes:**
- The `-d` flag can only disable auto-stop (set to false)
- To force enable auto-stop, use environment variable or config file

---

### `base_dir`

Base directory for storing container configurations and mounted files.

| Type | Default |
|------|---------|
| string | `~/.code-container` |

**Configuration Methods:**

| Method | Syntax | Example |
|--------|--------|---------|
| **config.yaml** | `base_dir: path` | `base_dir: ~/my-container-config` |
| **Environment Variable** | `CONTAINER_BASE_DIR=path` | `CONTAINER_BASE_DIR=/opt/container` |

**Behavior:**
- Used as `${base_dir}` variable in mount configurations
- Stores copied config files in `${base_dir}/configs/`
- Creates directory if it doesn't exist

**Example:**
```yaml
# config.yaml
base_dir: ~/my-container-config
mounts:
  - name: claude
    config_path: ${base_dir}/configs/.claude  # Expands to ~/my-container-config/configs/.claude
    dest: /root/.claude
```

---

## Environment Variables Reference

All environment variables use the `CONTAINER_` prefix with uppercase naming:

| Config Key | Environment Variable | Type | Example |
|------------|---------------------|------|---------|
| `auto_stop` | `CONTAINER_AUTO_STOP` | boolean | `CONTAINER_AUTO_STOP=false` |
| `base_dir` | `CONTAINER_BASE_DIR` | string | `CONTAINER_BASE_DIR=/opt/container` |

**Naming Convention:**
- Prefix: `CONTAINER_`
- Config key: Convert to uppercase with underscores
- Example: `base_dir` → `CONTAINER_BASE_DIR`

## Command-line Flags Reference

| Flag | Config Key | Overrides | Description |
|------|-----------|-----------|-------------|
| `-d` | `auto_stop` | Sets to `false` | Keep container running after exit |
| `--dry-run`, `-n` | N/A | N/A | Show commands without executing |
| `-a` | N/A | N/A | Stop all containers (used with `stop` command) |

## Configuration File (config.yaml)

### Location

Default path: `~/.code-container/config.yaml`

Custom path: Set via `CONTAINER_BASE_DIR` environment variable

### Structure

```yaml
# Base directory for configurations
base_dir: ~/.code-container

# Auto-stop on exit
auto_stop: true

# Mount configurations
mounts:
  # AI/Code Assistant Configs
  - name: claude
    source: ~/.claude                    # Source path (for init copy)
    config_path: ${base_dir}/configs/.claude  # Storage path (for mount)
    dest: /root/.claude                  # Container mount point
    readonly: false
    enabled: true

  - name: gitconfig
    config_path: ~/.gitconfig
    dest: /root/.gitconfig
    readonly: true
    enabled: false                       # Disabled mounts are ignored
```

### Mount Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Human-readable mount name |
| `source` | string | No | Source path for copying during `init` |
| `config_path` | string | Yes | Path to mount into container |
| `dest` | string | Yes | Destination path inside container |
| `readonly` | boolean | No | Mount as read-only (default: `false`) |
| `enabled` | boolean | No | Enable/disable mount (default: `true`) |

### Variable Expansion

`${base_dir}` in `config_path` is automatically expanded to the `base_dir` value:

```yaml
base_dir: ~/my-config

mounts:
  - config_path: ${base_dir}/configs/.claude  # Expands to ~/my-config/configs/.claude
```

## Usage Examples

### Example 1: Development Workflow

```bash
# Set default behavior in config.yaml
# cat ~/.code-container/config.yaml
auto_stop: true

# Normal development: auto-stop enabled
container run

# Long-running service: override with -d
container run -d -- npm start

# Temporary debugging: override with environment variable
CONTAINER_AUTO_STOP=false container run -- npm run dev
```

### Example 2: Team Configuration

```bash
# Team shares config.yaml with auto_stop: true

# Developer A: uses default (auto-stop)
container run

# Developer B: prefers persistent containers
# Sets in shell profile: export CONTAINER_AUTO_STOP=false
container run  # Always keeps running
```

### Example 3: CI/CD Environment

```bash
# CI environment uses environment variables
CONTAINER_AUTO_STOP=false \
CONTAINER_BASE_DIR=/tmp/ci-config \
container run -- npm test
```

### Example 4: Custom Mount Configuration

```yaml
# ~/.code-container/config.yaml
base_dir: ~/my-container

mounts:
  # Mount project-specific tools
  - name: my-tools
    config_path: ${base_dir}/tools
    dest: /usr/local/bin/my-tools
    readonly: true

  # Mount development configs
  - name: dev-config
    source: ~/dev-configs/.npmrc
    config_path: ${base_dir}/configs/.npmrc
    dest: /root/.npmrc
```

## Best Practices

1. **Use config.yaml for persistent settings**
   - Set your preferred defaults in `config.yaml`
   - Commit to version control for team consistency

2. **Use environment variables for temporary overrides**
   - Override in CI/CD pipelines
   - Set in shell profiles for personal preferences
   - Use for project-specific settings

3. **Use command-line flags for one-time changes**
   - `-d` flag for long-running services
   - `--dry-run` for testing Docker commands

4. **Keep sensitive data in environment variables**
   - Don't commit API keys to config.yaml
   - Use `CONTAINER_*` variables in secure environments

## Troubleshooting

### Check Current Configuration

```bash
# View config file
cat ~/.code-container/config.yaml

# Check environment variables
echo $CONTAINER_AUTO_STOP
echo $CONTAINER_BASE_DIR

# Test with dry-run
container --dry-run run
```

### Debug Mount Issues

```bash
# Check which mounts are applied
container --dry-run run | grep -E "^-v"

# Verify mount paths exist
ls -la ~/.code-container/configs/
```

### Reset to Default Configuration

```bash
# Backup current config
mv ~/.code-container/config.yaml ~/.code-container/config.yaml.bak

# Re-run init to create default
container init
```

## See Also

- [Consumer Guide](./ConsumerGuide.md) - Getting started with container
- [Permissions Guide](./Permissions.md) - Understanding and configuring permissions
