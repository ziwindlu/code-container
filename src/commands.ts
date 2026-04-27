import * as path from "path";
import * as fs from "fs";
import {
  printInfo,
  printSuccess,
  printWarning,
  printError,
  promptYesNo,
} from "./utils";
import {
  generateContainerName,
  imageExists,
  buildImageRaw,
  containerExists,
  containerRunning,
  stopContainer,
  startContainer,
  removeContainer,
  createNewContainer,
  execInteractive,
  execCommand,
  stopContainerIfLastSession,
  listContainersRaw,
  getStoppedContainerIds,
  removeContainersById,
  getRunningContainerNames,
  IMAGE_NAME,
  IMAGE_TAG,
} from "./docker";
import {
  loadSettings,
  saveSettings,
  copyConfigs,
  ensureConfigDir as ensureLegacyConfigDir,
} from "./config";
import {
  createDefaultConfig,
  ensureConfigDir,
  getConfigDir,
  copyConfigsFromYaml,
  loadConfig,
} from "./config-loader";

export function buildImage(): void {
  printInfo(`Building Docker image: ${IMAGE_NAME}:${IMAGE_TAG}`);
  if (!buildImageRaw()) {
    printError("Failed to build Docker image");
    process.exit(1);
  }
  printSuccess("Docker image built successfully");
}

export async function init(isStartup: boolean = false): Promise<void> {
  const settings = loadSettings();

  // Ensure config.yaml exists
  createDefaultConfig();

  // Get the actual config directory (may be customized)
  const configDir = getConfigDir();

  if (isStartup) {
    // If startup: Check if completedInit, if not, prompt.
    if (!settings.completedInit) {
      printInfo("First run detected. Would you like to copy config files?");
      printInfo(
        `This will copy your OpenCode, Codex, Claude Code, & Gemini CLI configs to ${configDir}/configs for mounting.`
      );
      printInfo(
        "If you choose to not copy config files, you can still setup your harness once inside the container."
      );

      const shouldCopy = await promptYesNo("Copy config files?");
      if (shouldCopy) {
        copyConfigsFromYaml();
        printSuccess("Config files copied successfully");
      } else {
        printInfo("Ignoring copy. Run `container init` to copy.");
      }
    }
    settings.completedInit = true;
    saveSettings(settings);
  } else {
    // Else, not startup; user ran container init
    if (!settings.completedInit) {
      printInfo(`Copying config files to ${configDir}/configs...`);
      copyConfigsFromYaml();
      printSuccess("Config files copied successfully");

      settings.completedInit = true;
      saveSettings(settings);
    } else {
      printWarning(
        "Config files already exist. This operation will merge and overwrite existing config files."
      );
      const shouldCopy = await promptYesNo("Continue?");
      if (shouldCopy) {
        copyConfigsFromYaml();
        printSuccess("Config files copied successfully");
      }
    }
  }
}

export async function runContainer(
  projectPath: string,
  cliFlags: string[] = [],
  noAutoStop: boolean = false,
  command: string[] = []
): Promise<void> {
  const containerName = generateContainerName(projectPath);
  const projectName = path.basename(projectPath);

  if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
    printError(
      `Project directory does not exist or is not a directory: ${projectPath}`
    );
    process.exit(1);
  }

  ensureConfigDir();

  const config = loadConfig();
  const shouldAutoStop = !noAutoStop && config.auto_stop;

  if (!imageExists()) {
    printWarning("Docker image not found. Building...");
    buildImage();
  }

  if (containerRunning(containerName)) {
    printInfo(`Container '${containerName}' is already running`);
    if (cliFlags.length > 0) {
      printWarning(`Docker flags (${cliFlags.join(" ")}) are ignored for existing containers`);
      printInfo("To apply new flags, remove the container first: container remove " + projectPath);
    }
    printInfo("Attaching to container...");
    if (command.length > 0) {
      printInfo(`Executing command: ${command.join(" ")}`);
      execCommand(containerName, projectName, command);
    } else {
      printInfo("Starting interactive bash shell");
      execInteractive(containerName, projectName);
    }
    if (shouldAutoStop) {
      stopContainerIfLastSession(containerName, projectName);
    }
    return;
  }

  if (containerExists(containerName)) {
    printInfo(`Starting existing container: ${containerName}`);
    if (cliFlags.length > 0) {
      printWarning(`Docker flags (${cliFlags.join(" ")}) are ignored for existing containers`);
      printInfo("To apply new flags, remove the container first: container remove " + projectPath);
    }
    startContainer(containerName);
    if (command.length > 0) {
      printInfo(`Executing command: ${command.join(" ")}`);
      execCommand(containerName, projectName, command);
    } else {
      printInfo("Starting interactive bash shell");
      execInteractive(containerName, projectName);
    }
    if (shouldAutoStop) {
      stopContainerIfLastSession(containerName, projectName);
    }
    return;
  }

  printInfo(`Creating new container: ${containerName}`);
  printInfo(`Project: ${projectPath}`);
  if (cliFlags.length > 0) {
    printInfo(`Docker flags: ${cliFlags.join(" ")}`);
  }

  if (!createNewContainer(containerName, projectName, projectPath, cliFlags)) {
    printError("Failed to create container");
    process.exit(1);
  }

  if (command.length > 0) {
    printInfo(`Executing command: ${command.join(" ")}`);
    execCommand(containerName, projectName, command);
  } else {
    printInfo("Starting interactive bash shell");
    execInteractive(containerName, projectName);
  }
  if (shouldAutoStop) {
    stopContainerIfLastSession(containerName, projectName);
  }
  printSuccess("Container session ended");
}

export function stopContainerForProject(projectPath: string): void {
  const containerName = generateContainerName(projectPath);

  if (!containerExists(containerName)) {
    printError(`Container does not exist: ${containerName}`);
    process.exit(1);
  }

  if (containerRunning(containerName)) {
    printInfo(`Stopping container: ${containerName}`);
    stopContainer(containerName);
    printSuccess("Container stopped");
  } else {
    printWarning(`Container is not running: ${containerName}`);
  }
}

export function stopAllContainers(): void {
  const runningContainers = getRunningContainerNames();

  if (runningContainers.length === 0) {
    printInfo("No running Code containers to stop");
    return;
  }

  printInfo(`Stopping ${runningContainers.length} container(s)...`);
  for (const containerName of runningContainers) {
    printInfo(`Stopping: ${containerName}`);
    stopContainer(containerName);
  }
  printSuccess("All containers stopped");
}

export function removeContainerForProject(projectPath: string): void {
  const containerName = generateContainerName(projectPath);

  if (!containerExists(containerName)) {
    printError(`Container does not exist: ${containerName}`);
    process.exit(1);
  }

  if (containerRunning(containerName)) {
    printInfo(`Stopping container: ${containerName}`);
    stopContainer(containerName);
  }

  printInfo(`Removing container: ${containerName}`);
  removeContainer(containerName);
  printSuccess("Container removed");
}

export function listContainers(): void {
  printInfo("Code Containers:");
  listContainersRaw();
}

export function cleanContainers(): void {
  printInfo("Removing all stopped Code containers...");
  const containerIds = getStoppedContainerIds();

  if (containerIds.length === 0) {
    printInfo("No stopped Code containers to remove");
    return;
  }

  removeContainersById(containerIds);
  printSuccess("Cleanup complete");
}
