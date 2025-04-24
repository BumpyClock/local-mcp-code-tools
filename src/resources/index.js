/**
 * Resources module index
 */

import { registerFileResource } from './file-resource.js';
import { registerProjectResource } from './project-resource.js';
import { logger } from '../utils/index.js';

/**
 * Register all resources with the MCP server
 * @param {object} server - The MCP server instance
 */
export function registerResources(server) {
  logger.info('Registering all resources');
  
  registerFileResource(server);
  registerProjectResource(server);
}

export default {
  registerResources,
  registerFileResource,
  registerProjectResource,
};
