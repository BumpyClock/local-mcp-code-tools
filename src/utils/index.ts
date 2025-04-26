/**
 * Utils module index
 */

import logger from "./logger.js";
import file from "./file.js";
import process from "./process.js";
import { Utils } from "../types/index.js";

export { logger, file, process };

const utils: Utils = {
  logger,
  file,
  process,
};

export default utils;
