import { config } from '../config/env';

export const repositoryService = {
  getMetadata() {
    return {
      name: 'CXXX',
      description: 'CloudStream repository metadata',
      manifestVersion: 1,
      sourceUrl: config.REPOSITORY_URL,
      pluginExecution: 'unsupported',
      note: 'CloudStream .cs3 binaries are not loaded or executed by this Node.js service.',
    };
  },
};
