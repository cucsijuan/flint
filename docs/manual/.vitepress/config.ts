import { defineConfig } from 'vitepress'

const chapters: [string, string][] = [
  ['Vaults and files', 'vaults-and-files'],
  ['The editor', 'editor'],
  ['Markdown reference', 'markdown'],
  ['Links and the graph', 'links-and-graph'],
  ['Search', 'search'],
  ['Workspace', 'workspace'],
  ['Daily notes and templates', 'daily-notes-and-templates'],
  ['Bases', 'bases'],
  ['Canvas', 'canvas'],
  ['Export and version history', 'export-and-history'],
  ['Settings and customization', 'settings'],
  ['Plugins', 'plugins'],
  ['Reference', 'reference'],
]

export default defineConfig({
  title: 'Flint',
  description: 'User manual for Flint, an open-source editor for a folder of Markdown notes.',
  base: '/flint/',
  cleanUrls: true,
  lastUpdated: true,
  rewrites: { 'README.md': 'index.md' },
  markdown: {
    // Template variables such as `{{title}}` must stay text, not Vue interpolations.
    config(md) {
      const render = md.renderer.rules.code_inline
      md.renderer.rules.code_inline = (...args) =>
        (render?.(...args) ?? '').replace('<code', '<code v-pre')
    },
  },
  themeConfig: {
    nav: [
      { text: 'Quick start', link: '/#quick-start' },
      { text: 'Download', link: 'https://github.com/cucsijuan/flint/releases/latest' },
    ],
    sidebar: [
      { text: 'Start here', items: [{ text: 'Quick start', link: '/#quick-start' }] },
      { text: 'Manual', items: chapters.map(([text, page]) => ({ text, link: `/${page}` })) },
    ],
    outline: [2, 3],
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/cucsijuan/flint' }],
    editLink: {
      pattern: 'https://github.com/cucsijuan/flint/edit/main/docs/manual/:path',
      text: 'Edit this page on GitHub',
    },
    footer: { message: 'Released under the AGPL-3.0-or-later license.' },
  },
})
