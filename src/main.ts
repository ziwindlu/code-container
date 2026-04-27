#!/usr/bin/env node

import { printError, printInfo, promptYesNo, resolveProjectPath } from "./utils";
import {
  buildImage,
  runContainer,
  stopContainerForProject,
  stopAllContainers,
  removeContainerForProject,
  listContainers,
  cleanContainers,
  init,
} from "./commands";
import { checkDocker } from "./docker";
import { loadSettings, saveSettings, setDryRun } from "./config";
import { ensureMountsFile } from "./mounts";

const TOS = `
\x1b[33m⚠️  Security Advisory:\x1b[0m

The main purpose of Code Container is to protect commands like 'rm' or 'apt'
from unintentionally affecting your main system.

container does not protect from prompt injections in the event that an agent
becomes malaligned.

This is an innate problem within coding harness software and container does
not attempt to solve it.

Users are advised to not download or work with unverified software.
- Sensitive information inside the container may still be exfiltrated by
  an attacker just as with your regular system.
  - This includes:
  - OAuth credentials inside harness configs
  - API keys inside harness configs
  - SSH keys for git functionality if enabled

Never install or run your harness on unverified software. By using Code
Container, you agree that you are aware of these risks and will not hold the
author liable for any outcomes arising from usage of the software.
`;

async function ensureTosAccepted(): Promise<boolean> {
  const settings = loadSettings();
  if (settings.acceptedTos) {
    return true;
  }

  console.log(TOS);
  const accepted = await promptYesNo("Do you accept these terms?");
  if (accepted) {
    settings.acceptedTos = true;
    saveSettings(settings);
    return true;
  }
  return false;
}

function usage(): void {
  console.log(`
Usage: container [COMMAND] [OPTIONS] [PATH] [-- COMMAND [ARGS...]]

Manage Code containers for isolated project environments.

Global Options:
    --dry-run, -n   Show commands without executing them

Commands:
    (none)         Start container for current directory (default)
    run            Start container with options
    build          Build the Docker image
    init           Copy config files from home directory
    stop           Stop the container for this project
    remove         Remove the container for this project
    list           List all Code containers
    clean          Remove all stopped Code containers

Options (run command):
    -d             Keep container running after exit
    PATH           Project directory (optional, default: current directory)
    [docker-flags] Additional flags passed to 'docker run' (e.g., -p, -v, -e)

Config (config.yaml):
    auto_stop:     Stop container on exit (default: true)
                   Set to false to keep container running after exit
                   without needing -d flag each time

Environment Variables:
    CONTAINER_AUTO_STOP=true/false   Override auto_stop config (highest priority)
    CONTAINER_BASE_DIR=/path         Override base_dir config

Arguments:
    COMMAND        Command to execute in container (optional, after --)
    ARGS           Arguments for the command

Examples:
    container                           # Start with bash (current dir)
    container run                       # Same as above
    container run -d                    # Keep container running
    container run /path/to/project      # Start for specific path
    container run -- ls -la             # Execute 'ls -la' in container
    container run -- npm install        # Execute 'npm install'
    container run -d -- npm start       # Run command and keep running
    container run /path -- python app.py # Run Python script
    container run -d -p 80:8000 -- npm start  # Port mapping + command
    container run -d -p 80:8000 $PWD -- ls  # Port mapping + explicit path
    container run -p 80:8000 -- ls       # Port mapping (current dir)
    container --dry-run -- ls           # Show commands without executing
    container -n run -d -p 80:8000      # Dry run with all options
    container build                     # Build Docker image
    container init                      # Copy config files
    container stop                      # Stop container for current directory
    container stop -a                   # Stop all running containers
    container remove /path/to/project   # Remove container for specific project
    container list                      # List all containers
    container clean                     # Clean up stopped containers

Behavior:
    - Without -- : Starts interactive bash shell
    - With -- COMMAND : Executes command and exits (auto-stops unless -d is used)
    - PATH can be specified before -- or docker flags (default: current directory)
    - Docker flags like -p, -v, -e are passed directly to docker run
    - --dry-run/-n : Print docker commands without executing them

Similar to docker run:
    docker run [OPTIONS] IMAGE [COMMAND]
    container run [OPTIONS] [PATH] [-- COMMAND]
`);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let command = "";
  let projectPath = "";
  let cliFlags: string[] = [];
  let noAutoStop = false;
  let stopAll = false;
  let execCommand: string[] = [];
  let dryRun = false;

  if (args.length > 0) {
    // Check for global --dry-run or -n flag first
    const dryRunIndex = args.indexOf("--dry-run");
    const nIndex = args.indexOf("-n");
    if (dryRunIndex !== -1 || nIndex !== -1) {
      dryRun = true;
      setDryRun(true);
      // Remove dry-run flag from args
      const argsCopy = [...args];
      if (dryRunIndex !== -1) {
        argsCopy.splice(dryRunIndex, 1);
      }
      if (nIndex !== -1) {
        const newNIndex = argsCopy.indexOf("-n");
        if (newNIndex !== -1) {
          argsCopy.splice(newNIndex, 1);
        }
      }
      args.length = 0;
      args.push(...argsCopy);
    }

    const firstArg = args[0];
    if (firstArg === "help" || firstArg === "--help" || firstArg === "-h") {
      usage();
    }

    const validCommands = [
      "run",
      "build",
      "init",
      "stop",
      "remove",
      "list",
      "clean",
    ];
    if (validCommands.includes(firstArg)) {
      command = firstArg;
      let remainingArgs = args.slice(1);

      // Extract -a flag for stop command (first, before other parsing)
      if (command === "stop") {
        const aIndex = remainingArgs.indexOf("-a");
        if (aIndex !== -1) {
          stopAll = true;
          remainingArgs = remainingArgs.filter((_, i) => i !== aIndex);
        }
      }

      // Parse run command options
      if (command === "run" || command === "") {
        const commandSepIndex = remainingArgs.indexOf("--");

        if (commandSepIndex !== -1) {
          // Has -- separator
          const optionsPart = remainingArgs.slice(0, commandSepIndex);

          // Extract -d flag
          const dIndex = optionsPart.indexOf("-d");
          if (dIndex !== -1) {
            noAutoStop = true;
            optionsPart.splice(dIndex, 1);
          }

          // Extract project path from options (first non-option argument)
          // Path is the first argument that doesn't start with -
          for (let i = 0; i < optionsPart.length; i++) {
            const arg = optionsPart[i];
            if (arg.startsWith("-")) {
              // This is an option, skip it and its value if it takes one
              if (arg === "-p" || arg === "-v" || arg === "-e") {
                i++; // Skip the option value
              }
            } else {
              // This is the project path
              projectPath = arg;
              optionsPart.splice(i, 1);
              break;
            }
          }

          // Remaining options are docker flags
          cliFlags = optionsPart;

          // Command is after --
          execCommand = remainingArgs.slice(commandSepIndex + 1);
        } else {
          // No -- separator: parse all as options
          // Extract -d flag
          const dIndex = remainingArgs.indexOf("-d");
          if (dIndex !== -1) {
            noAutoStop = true;
            remainingArgs.splice(dIndex, 1);
          }

          // Extract project path from remaining args
          for (let i = 0; i < remainingArgs.length; i++) {
            const arg = remainingArgs[i];
            if (arg.startsWith("-")) {
              // This is an option, skip it and its value if it takes one
              if (arg === "-p" || arg === "-v" || arg === "-e") {
                i++; // Skip the option value
              }
            } else {
              // This is the project path
              projectPath = arg;
              remainingArgs.splice(i, 1);
              break;
            }
          }

          // Remaining args are docker flags
          cliFlags = remainingArgs;
        }
      }
    } else {
      printError(`Unknown command: ${firstArg}`);
      usage();
    }
  }

  if (!await ensureTosAccepted()) {
    printInfo("Terms not accepted. Exiting...");
    process.exit(1);
  }

  await ensureMountsFile();

  if (command === "init") {
    await init();
    return;
  }

  checkDocker();
  await init(true);
  const resolvedPath = resolveProjectPath(projectPath);

  switch (command) {
    case "list":
      listContainers();
      return;
    case "clean":
      cleanContainers();
      return;
    case "build":
      buildImage();
      return;
    case "stop":
      if (stopAll) {
        stopAllContainers();
      } else {
        stopContainerForProject(resolvedPath);
      }
      return;
    case "remove":
      removeContainerForProject(resolvedPath);
      return;
    case "run":
    case "":
      await runContainer(resolvedPath, cliFlags, noAutoStop, execCommand);
      return;
  }
}

main();
