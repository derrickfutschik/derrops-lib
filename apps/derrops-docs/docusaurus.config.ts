import type * as Preset from '@docusaurus/preset-classic'
import type { Config } from '@docusaurus/types'
import { themes as prismThemes } from 'prism-react-renderer'
import rehypeKatex from 'rehype-katex'
import remarkCodeImport from 'remark-code-import'
import remarkMath from 'remark-math'

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

// ---------------------------------------------------------------------------
// Directory / access model
// ---------------------------------------------------------------------------
// public/   → no auth required  (routes: /docs, /security)
// internal/ → Cognito auth required  (routes: /internal/*)
//
// The /internal/* prefix is the single choke-point protected at the Amplify
// Hosting layer (see amplify.yml). Nothing inside docusaurus.config.ts itself
// enforces auth — the convention is purely structural.
// ---------------------------------------------------------------------------

const config: Config = {
  title: 'Derrops',
  tagline: 'Derrops the Devops Engineer',
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

  // Register Iconify logos (AWS, etc.) for Mermaid architecture diagrams
  clientModules: [require.resolve('./src/scripts/mermaid-icons.ts')],

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://blog.Derrops.com',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'derrickfutschik', // Usually your GitHub org/user name.
  projectName: 'derrops-platform', // Usually your repo name.
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
          // PUBLIC: user-facing platform documentation
          path: 'public/docs',
          routeBasePath: 'docs',
          sidebarPath: './sidebars.ts',

          editUrl: ({ docPath }) => {
            const awsBranch = process.env.AWS_BRANCH
            if (awsBranch) {
              const cleanPath = docPath.replace(/^\//, '')
              return `https://github.com/derrickfutschik/derrops-platform/tree/${awsBranch}/apps/derrops-docs/public/docs/${cleanPath}`
            }
            const cleanPath = docPath.replace(/^\//, '')
            const pathToFile = `${process.cwd()}/public/docs/${cleanPath}`
            return `cursor://file${pathToFile}`
          },

          exclude: ['**/CLAUDE.md'],
          onInlineTags: 'warn',
          remarkPlugins: [remarkMath, remarkCodeImport],
          rehypePlugins: [rehypeKatex],
        },
        blog: {
          showReadingTime: true,
          exclude: ['**/CLAUDE.md'],
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },

          editUrl: process.env.AWS_BRANCH
            ? `https://github.com/derrickfutschik/derrops-platform/tree/${process.env.AWS_BRANCH}/apps/derrops-docs/blog`
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
    // -------------------------------------------------------------------------
    // Changelog (public)
    // -------------------------------------------------------------------------
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
          title: 'Derrops Changelog',
          copyright: `Copyright © ${new Date().getFullYear()} Derrops`,
        },
      },
    ],

    // -------------------------------------------------------------------------
    // PUBLIC: customer security / compliance overview
    // -------------------------------------------------------------------------
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'security-public',
        path: 'public/security',
        routeBasePath: 'security',
        exclude: ['**/CLAUDE.md'],
        sidebarPath: './sidebars-security-public.ts',
        editUrl: ({ docPath }) => {
          const awsBranch = process.env.AWS_BRANCH
          if (awsBranch) {
            const cleanPath = docPath.replace(/^\//, '')
            return `https://github.com/derrickfutschik/derrops-platform/tree/${awsBranch}/apps/derrops-docs/public/security/${cleanPath}`
          }
          const cleanPath = docPath.replace(/^\//, '')
          const pathToFile = `${process.cwd()}/public/security/${cleanPath}`
          return `cursor://file${pathToFile}`
        },
        remarkPlugins: [remarkMath, remarkCodeImport],
        rehypePlugins: [rehypeKatex],
      },
    ],

    // -------------------------------------------------------------------------
    // INTERNAL: platform design records (implemented designs)
    // -------------------------------------------------------------------------
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'platform-design',
        path: 'internal/platform/design',
        routeBasePath: 'internal/platform/design',
        exclude: ['**/CLAUDE.md'],
        sidebarPath: './sidebars-platform-design.ts',
        tagsBasePath: 'tags',
        onInlineTags: 'warn',
        editUrl: ({ docPath }) => {
          const awsBranch = process.env.AWS_BRANCH
          if (awsBranch) {
            const cleanPath = docPath.replace(/^\//, '')
            return `https://github.com/derrickfutschik/derrops-platform/tree/${awsBranch}/apps/derrops-docs/internal/platform/design/${cleanPath}`
          }
          const cleanPath = docPath.replace(/^\//, '')
          const pathToFile = `${process.cwd()}/internal/platform/design/${cleanPath}`
          return `cursor://file${pathToFile}`
        },
        remarkPlugins: [remarkMath, remarkCodeImport],
        rehypePlugins: [rehypeKatex],
      },
    ],

    // -------------------------------------------------------------------------
    // INTERNAL: platform drafts (WIP ideas, research notes)
    // -------------------------------------------------------------------------
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'platform-drafts',
        path: 'internal/platform/drafts',
        routeBasePath: 'internal/platform/drafts',
        exclude: ['**/CLAUDE.md'],
        sidebarPath: './sidebars-platform-drafts.ts',
        editUrl: ({ docPath }) => {
          const awsBranch = process.env.AWS_BRANCH
          if (awsBranch) {
            const cleanPath = docPath.replace(/^\//, '')
            return `https://github.com/derrickfutschik/derrops-platform/tree/${awsBranch}/apps/derrops-docs/internal/platform/drafts/${cleanPath}`
          }
          const cleanPath = docPath.replace(/^\//, '')
          const pathToFile = `${process.cwd()}/internal/platform/drafts/${cleanPath}`
          return `cursor://file${pathToFile}`
        },
        remarkPlugins: [remarkMath, remarkCodeImport],
        rehypePlugins: [rehypeKatex],
      },
    ],

    // -------------------------------------------------------------------------
    // INTERNAL: developer / codebase docs (auto-copied monorepo READMEs)
    // -------------------------------------------------------------------------
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'developer',
        path: 'internal/developer/code',
        routeBasePath: 'internal/developer',
        exclude: ['**/CLAUDE.md'],
        sidebarPath: './sidebars-developer.ts',
        editUrl: ({ docPath }) => {
          const awsBranch = process.env.AWS_BRANCH
          if (awsBranch) {
            const cleanPath = docPath.replace(/^\//, '')
            return `https://github.com/derrickfutschik/derrops-platform/tree/${awsBranch}/apps/derrops-docs/internal/developer/code/${cleanPath}`
          }
          const cleanPath = docPath.replace(/^\//, '')
          const pathToFile = `${process.cwd()}/internal/developer/code/${cleanPath}`
          return `cursor://file${pathToFile}`
        },
        remarkPlugins: [remarkMath, remarkCodeImport],
        rehypePlugins: [rehypeKatex],
      },
    ],

    // -------------------------------------------------------------------------
    // INTERNAL: devops — sprint planning, user stories
    // -------------------------------------------------------------------------
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'devops',
        path: 'internal/devops',
        routeBasePath: 'internal/devops',
        exclude: ['**/CLAUDE.md'],
        sidebarPath: './sidebars-devops.ts',
        editUrl: ({ docPath }) => {
          const awsBranch = process.env.AWS_BRANCH
          if (awsBranch) {
            const cleanPath = docPath.replace(/^\//, '')
            return `https://github.com/derrickfutschik/derrops-platform/tree/${awsBranch}/apps/derrops-docs/internal/devops/${cleanPath}`
          }
          const cleanPath = docPath.replace(/^\//, '')
          const pathToFile = `${process.cwd()}/internal/devops/${cleanPath}`
          return `cursor://file${pathToFile}`
        },
        remarkPlugins: [remarkMath, remarkCodeImport],
        rehypePlugins: [rehypeKatex],
      },
    ],

    // -------------------------------------------------------------------------
    // INTERNAL: security knowledge base (threat models, compliance, pen-tests)
    // -------------------------------------------------------------------------
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'security-internal',
        path: 'internal/security',
        routeBasePath: 'internal/security',
        exclude: ['**/CLAUDE.md'],
        sidebarPath: './sidebars-security-internal.ts',
        editUrl: ({ docPath }) => {
          const awsBranch = process.env.AWS_BRANCH
          if (awsBranch) {
            const cleanPath = docPath.replace(/^\//, '')
            return `https://github.com/derrickfutschik/derrops-platform/tree/${awsBranch}/apps/derrops-docs/internal/security/${cleanPath}`
          }
          const cleanPath = docPath.replace(/^\//, '')
          const pathToFile = `${process.cwd()}/internal/security/${cleanPath}`
          return `cursor://file${pathToFile}`
        },
        remarkPlugins: [remarkMath, remarkCodeImport],
        rehypePlugins: [rehypeKatex],
      },
    ],

    // -------------------------------------------------------------------------
    // INTERNAL: testing — test reports
    // -------------------------------------------------------------------------
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'testing',
        path: 'internal/testing',
        routeBasePath: 'internal/testing',
        exclude: ['**/CLAUDE.md'],
        sidebarPath: './sidebars-testing.ts',
        editUrl: ({ docPath }) => {
          const awsBranch = process.env.AWS_BRANCH
          if (awsBranch) {
            const cleanPath = docPath.replace(/^\//, '')
            return `https://github.com/derrickfutschik/derrops-platform/tree/${awsBranch}/apps/derrops-docs/internal/testing/${cleanPath}`
          }
          const cleanPath = docPath.replace(/^\//, '')
          const pathToFile = `${process.cwd()}/internal/testing/${cleanPath}`
          return `cursor://file${pathToFile}`
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
      integrity: 'sha384-odtC+0UGzzFL/6PNoE8rX/SPcQDXBJ+uRepguP4QkPCm2LBxH3FA3y+fKSiJ+AmM',
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
        // -----------------------------------------------------------------------
        // PUBLIC (left side) — no auth required
        // -----------------------------------------------------------------------
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          type: 'docSidebar',
          sidebarId: 'security-public',
          docsPluginId: 'security-public',
          position: 'left',
          label: 'Security',
        },
        { to: '/blog', label: 'Blog', position: 'left' },
        { to: '/changelog', label: 'Changelog', position: 'left' },

        // -----------------------------------------------------------------------
        // INTERNAL (right side) — protected at Amplify layer (/internal/*)
        // -----------------------------------------------------------------------
        {
          type: 'dropdown',
          label: 'Internal',
          position: 'right',
          items: [
            {
              type: 'docSidebar',
              sidebarId: 'platform-design',
              docsPluginId: 'platform-design',
              label: 'Platform — Design',
            },
            {
              type: 'docSidebar',
              sidebarId: 'platform-drafts',
              docsPluginId: 'platform-drafts',
              label: 'Platform — Drafts',
            },
            {
              type: 'docSidebar',
              sidebarId: 'developer',
              docsPluginId: 'developer',
              label: 'Developer',
            },
            {
              type: 'docSidebar',
              sidebarId: 'devops',
              docsPluginId: 'devops',
              label: 'DevOps',
            },
            {
              type: 'docSidebar',
              sidebarId: 'security-internal',
              docsPluginId: 'security-internal',
              label: 'Security KB',
            },
            {
              type: 'docSidebar',
              sidebarId: 'testing',
              docsPluginId: 'testing',
              label: 'Testing',
            },
          ],
        },
        {
          href: 'https://github.com/derrickfutschik/derrops-platform',
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
              href: 'https://stackoverflow.com/users/4033292/Derrops',
            },
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
              href: 'https://github.com/derrickfutschik/derrops-platform',
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
}

export default config
