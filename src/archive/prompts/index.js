/**
 * Prompts module index
 */

import { registerCodePrompts } from './code-prompts.js';
import { logger } from '../utils/index.js';

/**
 * Register all prompts with the MCP server
 * @param {object} server - The MCP server instance
 */
export function registerPrompts(server) {
  logger.info('Registering all prompts');
  
  registerCodePrompts(server);
}

export default {
  registerPrompts,
  registerCodePrompts,
};
