/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import pluginContentBlog from '@docusaurus/plugin-content-blog'
import { aliasedSitePath, docuHash, normalizeUrl, safeGlobby } from '@docusaurus/utils'
import fs from 'fs-extra'
import path from 'path'
import { createBlogFiles, toChangelogEntries } from './utils'

export { validateOptions } from '@docusaurus/plugin-content-blog'

const ChangelogFilePattern = 'CHANGELOG(-v[0-9]*)?.md'

async function getChangelogFiles(siteDir: string) {
  const files = await safeGlobby([ChangelogFilePattern], {
    cwd: siteDir,
  })
  if (files.length === 0) {
    throw new Error(
      "Looks like the changelog plugin didn't detect any changelog files matching the pattern: " +
        ChangelogFilePattern,
    )
  }
  return files
}

function readChangelogFile(siteDir: string, filename: string) {
  return fs.readFile(path.join(siteDir, filename), 'utf-8')
}

async function loadChangelogEntries(siteDir: string, changelogFiles: string[]) {
  const filesContent = await Promise.all(
    changelogFiles.map((file) => readChangelogFile(siteDir, file)),
  )
  return toChangelogEntries(filesContent)
}

const ChangelogPlugin: typeof pluginContentBlog = async function ChangelogPlugin(context, options) {
  const generateDir = path.join(context.siteDir, 'changelog/source')
  const blogPlugin = await pluginContentBlog(context, {
    ...options,
    path: generateDir,
    id: 'changelog',
    blogListComponent: '@theme/ChangelogList',
    blogPostComponent: '@theme/ChangelogPage',
  })
  const changelogFiles = await getChangelogFiles(context.siteDir)

  return {
    ...blogPlugin,
    name: 'changelog-plugin',

    async loadContent() {
      const changelogEntries = await loadChangelogEntries(context.siteDir, changelogFiles)
      await createBlogFiles(generateDir, changelogEntries)
      const content = (await blogPlugin.loadContent?.())!

      content.blogPosts.forEach((post, index) => {
        const pageIndex = Math.floor(index / (options.postsPerPage as number))
        post.metadata.listPageLink = normalizeUrl([
          context.baseUrl,
          options.routeBasePath,
          pageIndex === 0 ? '/' : `/page/${pageIndex + 1}`,
        ])
      })
      return content
    },

    configureWebpack(...args) {
      const config = blogPlugin.configureWebpack?.(...args)
      const pluginDataDirRoot = path.join(context.generatedFilesDir, 'changelog-plugin', 'default')
      const mdxLoader = config.module.rules[0].use[0]
      mdxLoader.options.metadataPath = (mdxPath: string) => {
        const aliasedPath = aliasedSitePath(mdxPath, context.siteDir)
        return path.join(pluginDataDirRoot, `${docuHash(aliasedPath)}.json`)
      }
      return config
    },

    getThemePath() {
      return './theme'
    },

    getPathsToWatch() {
      return [path.join(context.siteDir, ChangelogFilePattern)]
    },
  }
}

export default ChangelogPlugin
