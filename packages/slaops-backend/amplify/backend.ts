import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { createDatabaseResources } from './database/resource';

const backend = defineBackend({
  auth,
});

// Add database resources using CDK
createDatabaseResources(backend.createStack('SlaOpsDatabase'));
