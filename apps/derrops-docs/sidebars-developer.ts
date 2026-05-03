import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
  developer: [
    'intro',
    {
      type: 'category',
      label: 'Apps',
      items: [
        'apps/derrops-cloud',
        'apps/derrops-cloud/openapi-indexer',
        'apps/derrops-cloud/openapi-search',
        'apps/derrops-portal',
        'apps/derrops-relay',
        'apps/derrops-aegis',
      ],
    },
    {
      type: 'category',
      label: 'Packages',
      items: [
        'packages/derrops-config',
        'packages/derrops-private',
        'packages/derrops-public',
        'packages/derrops-backend',
        'packages/derrops-infra',
        'packages/derrops-client-nodejs-axios',
        'packages/derrops-test',
      ],
    },
  ],
}

export default sidebars
