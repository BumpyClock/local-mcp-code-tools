/**
 * Process utility functions for CodeTools MCP
 * 
 * Provides helper functions for running child processes safely
 */

import { spawn } from 'child_process';
import logger from './logger.js';

/**
 * Safely run a command in a child process
 * @param {string} command - The command to run
 * @param {string[]} args - Arguments for the command
 * @param {object} options - Additional options
 * @param {string} [options.cwd] - Working directory
 * @param {string} [options.stdinData] - Data to write to stdin
 * @param {boolean} [options.shell=true] - Whether to use shell
 * @param {boolean} [options.allowNonZeroExitCode=false] - Whether to resolve for non-zero exit codes
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
export async function runProcess(command, args = [], options = {}) {
  const {
    cwd,
    stdinData,
    shell = true,
    allowNonZeroExitCode = false,
  } = options;
  
  logger.debug(`Running command: ${command} ${args.join(' ')}`, { cwd });
  
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: cwd || undefined,
      shell,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    if (stdinData) {
      proc.stdin.write(stdinData);
      proc.stdin.end();
    }

    proc.on('close', (code) => {
      logger.debug(`Command completed with exit code: ${code}`, {
        command,
        args,
        cwd,
      });
      
      if (code === 0 || allowNonZeroExitCode) {
        resolve({ stdout, stderr, code });
      } else {
        reject({
          stdout,
          stderr,
          code,
          message: `Command failed with exit code ${code}: ${command} ${args.join(' ')}`,
        });
      }
    });

    proc.on('error', (err) => {
      logger.error(`Command failed to execute: ${command}`, {
        error: err.message,
        command,
        args,
        cwd,
      });
      
      reject({
        error: err.message,
        stdout,
        stderr,
        code: -1,
        message: `Failed to execute command: ${err.message}`,
      });
    });
  });
}

export default {
  runProcess,
};
