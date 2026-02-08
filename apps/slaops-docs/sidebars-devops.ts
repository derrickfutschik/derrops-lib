import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
  devops: [
    'index',
    {
      type: 'category',
      label: 'Sprints',
      items: ['sprints/index', 'sprints/2026-01-19'],
    },
    'user-stories/index',
    'user-stories/personas',
    'user-stories/client-user-stories',
    'user-stories/cloud-requester-user-stories',
    'user-stories/devops-user-stores',
    'user-stories/monitoring-user-stories',
    'user-stories/saas-management',
    'user-stories/CLAUDE',
  ],
}

export default sidebars
