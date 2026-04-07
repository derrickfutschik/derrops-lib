import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
  developer: [
    'intro',
    {
      type: 'category',
      label: 'Apps',
      items: [
        'apps/slaops-cloud',
        'apps/slaops-cloud/openapi-indexer',
        'apps/slaops-cloud/openapi-search',
        'apps/slaops-portal',
        'apps/slaops-relay',
        'apps/slaops-aegis',
      ],
    },
    {
      type: 'category',
      label: 'Packages',
      items: [
        'packages/slaops-config',
        'packages/slaops-private',
        'packages/slaops-public',
        'packages/slaops-backend',
        'packages/slaops-infra',
        'packages/slaops-client-nodejs-axios',
        'packages/slaops-test',
      ],
    },
  ],
}

export default sidebars
