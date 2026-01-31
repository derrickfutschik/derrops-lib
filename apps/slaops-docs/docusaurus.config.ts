import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkCodeImport from 'remark-code-import';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'SLAOps',
  tagline: 'SLAOps the Devops Engineer',
  favicon: 'img/favicon.ico',

  markdown: {
    mermaid: true,
    hooks: {
      // TODO - show stock image if images broken
      // onBrokenMarkdownImages: (brokenImagePath, sourceFilePath) => {
      //   console.warn(
      //     `⚠️  Broken image: ${brokenImagePath.pathname} in ${sourceFilePath}`
      //   );
      // },
    },
  },

  themes: ['@docusaurus/theme-mermaid'],

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://blog.SLAOps.com',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'derrickfutschik', // Usually your GitHub org/user name.
  projectName: 'slaops-platform', // Usually your repo name.
  deploymentBranch: 'main',

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',

          editUrl: ({ docPath }) => {
            const awsBranch = process.env.AWS_BRANCH;
            if (awsBranch) {
              const cleanPath = docPath.replace(/^\//, '');
              return `https://github.com/derrickfutschik/slaops-platform/tree/${awsBranch}/apps/slaops-docs/docs/${cleanPath}`;
            }
            const cleanPath = docPath.replace(/^\//, '');
            const pathToFile = `${process.cwd()}/docs/${cleanPath}`;
            return `cursor://file${pathToFile}`;
          },



          remarkPlugins: [remarkMath, remarkCodeImport],
          rehypePlugins: [rehypeKatex],
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },

          editUrl:
            process.env.AWS_BRANCH
              ? `https://github.com/derrickfutschik/slaops-platform/tree/${process.env.AWS_BRANCH}/apps/slaops-docs/blog`
              : `cursor://open?folder=/docs`,



          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
          remarkPlugins: [remarkMath, remarkCodeImport],
          rehypePlugins: [rehypeKatex],
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      require.resolve('./src/plugins/changelog'),
      {
        blogTitle: 'Changelog',
        blogDescription: 'Keep track of updates and releases',
        blogSidebarCount: 5,
        blogSidebarTitle: 'Recent releases',
        routeBasePath: '/changelog',
        postsPerPage: 20,
        archiveBasePath: null,
        authorsMapPath: 'authors.json',
        feedOptions: {
          type: 'all',
          title: 'SLAOps Changelog',
          copyright: `Copyright © ${new Date().getFullYear()} SLAOps`,
        },
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'notes',
        path: 'notes',
        routeBasePath: 'notes',
        sidebarPath: './sidebars.ts',
        editUrl: ({ docPath }) => {
          const awsBranch = process.env.AWS_BRANCH;
          if (awsBranch) {
            const cleanPath = docPath.replace(/^\//, '');
            return `https://github.com/derrickfutschik/slaops-platform/tree/${awsBranch}/apps/slaops-docs/notes/${cleanPath}`;
          }
          const cleanPath = docPath.replace(/^\//, '');
          const pathToFile = `${process.cwd()}/notes/${cleanPath}`;
          return `cursor://file${pathToFile}`;
        },
        remarkPlugins: [remarkMath, remarkCodeImport],
        rehypePlugins: [rehypeKatex],
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'devops',
        path: 'devops',
        routeBasePath: 'devops',
        sidebarPath: './sidebars-devops.ts',
        editUrl: ({ docPath }) => {
          const awsBranch = process.env.AWS_BRANCH;
          if (awsBranch) {
            const cleanPath = docPath.replace(/^\//, '');
            return `https://github.com/derrickfutschik/slaops-platform/tree/${awsBranch}/apps/slaops-docs/devops/${cleanPath}`;
          }
          const cleanPath = docPath.replace(/^\//, '');
          const pathToFile = `${process.cwd()}/devops/${cleanPath}`;
          return `cursor://file${pathToFile}`;
        },
        remarkPlugins: [remarkMath, remarkCodeImport],
        rehypePlugins: [rehypeKatex],
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'code',
        path: 'code',
        routeBasePath: 'code',
        sidebarPath: './sidebars-code.ts',
        editUrl: ({ docPath }) => {
          const awsBranch = process.env.AWS_BRANCH;
          if (awsBranch) {
            const cleanPath = docPath.replace(/^\//, '');
            return `https://github.com/derrickfutschik/slaops-platform/tree/${awsBranch}/apps/slaops-docs/code/${cleanPath}`;
          }
          const cleanPath = docPath.replace(/^\//, '');
          const pathToFile = `${process.cwd()}/code/${cleanPath}`;
          return `cursor://file${pathToFile}`;
        },
        remarkPlugins: [remarkMath, remarkCodeImport],
        rehypePlugins: [rehypeKatex],
      },
    ],
  ],

  stylesheets: [
    {
      href: 'https://cdn.jsdelivr.net/npm/katex@0.13.24/dist/katex.min.css',
      type: 'text/css',
      integrity:
        'sha384-odtC+0UGzzFL/6PNoE8rX/SPcQDXBJ+uRepguP4QkPCm2LBxH3FA3y+fKSiJ+AmM',
      crossorigin: 'anonymous',
    },
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Home',
      logo: {
        alt: 'Home',
        src: 'img/derrops.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          type: 'docSidebar',
          sidebarId: 'notes',
          docsPluginId: 'notes',
          position: 'left',
          label: 'Drafts',
        },
        { to: '/blog', label: 'Blog', position: 'left' },
        {
          type: 'docSidebar',
          sidebarId: 'code',
          docsPluginId: 'code',
          position: 'left',
          label: 'Code',
        },
        {
          type: 'docSidebar',
          sidebarId: 'devops',
          docsPluginId: 'devops',
          position: 'right',
          label: 'Devops',
        },
        { to: '/changelog', label: 'Changelog', position: 'left' },
        {
          href: 'https://github.com/derrickfutschik/slaops-platform',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Docs',
              to: '/docs/intro',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Stack Overflow',
              href: 'https://stackoverflow.com/users/4033292/SLAOps',
            }
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Blog',
              to: '/blog',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/derrickfutschik/slaops-platform',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} My Project, Inc. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
