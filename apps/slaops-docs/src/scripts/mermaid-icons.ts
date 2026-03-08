/**
 * Registers Iconify logos (AWS, GitHub, etc.) with Mermaid for architecture diagrams.
 * Must run before any diagram renders. Loaded via clientModules in docusaurus.config.
 *
 * @see https://mermaid.js.org/config/icons.html
 * @see https://www.simonpainter.com/mermaid-icons
 */
import mermaid from 'mermaid'
import { icons } from '@iconify-json/logos'

mermaid.registerIconPacks([
  {
    name: icons.prefix,
    icons,
  },
])
