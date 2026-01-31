import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  code: [
    'intro',
    {
      type: 'category',
      label: 'Apps',
      items: [
        'apps/slaops-cloud',
        'apps/slaops-cloud-openapi-indexer',
        'apps/slaops-cloud-openapi-search',
        'apps/slaops-portal',
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
};

export default sidebars;
