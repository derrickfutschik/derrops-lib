/**
 * Registers Iconify logos (AWS, GitHub, etc.) with Mermaid for architecture diagrams.
 * Loaded via clientModules in docusaurus.config.
 *
 * The icon pack is 7MB, so it is dynamically imported to keep it out of the
 * main bundle and prevent Rspack from stalling during minification.
 *
 * @see https://mermaid.js.org/config/icons.html
 * @see https://www.simonpainter.com/mermaid-icons
 */
import mermaid from 'mermaid'

import('@iconify-json/logos').then(({ icons }) => {
  mermaid.registerIconPacks([{ name: icons.prefix, icons }])
})
