import type { ChangeSet } from '@codemirror/state'
import { commands } from '../commands.svelte'
import { documents } from '../documents'
import { pluginHost } from '../plugins/host.svelte'
import * as vault from '../vault'
import { workspace } from '../workspace.svelte'
import type { EditorOptions } from './editor'

/** The editor setup for Markdown written in `path`: a note, or a canvas card resolving links from its canvas. */
export function editorOptions(
  path: string,
  doc: string,
  onChange: (changes: ChangeSet, contents: string) => void,
): EditorOptions {
  return {
    doc,
    mode: workspace.mode,
    vimMode: workspace.settings.value.vimMode,
    propertiesDisplay: workspace.propertiesDisplay,
    onChange,
    onKeydown: (event) => commands.handleKeydown(event),
    resolveLinks: (targets) => workspace.resolveLinks(targets, path),
    navigation: {
      openLink: (destination, options) => void workspace.openLink(destination, path, options),
      openTag: (tag) => workspace.openSearch(`tag:#${tag}`),
      openUrl: (url) => workspace.openUrl(url),
    },
    completion: {
      targets: () => workspace.linkTargets,
      headings: (target) => workspace.headingsFor(target, path),
      blocks: (target) => workspace.blocksFor(target, path),
      searchBlocks: (query) => workspace.searchBlocks(query),
      addBlockId: (note, block) => workspace.addBlockId(note, block),
      tags: () => workspace.tags,
    },
    plugins: pluginHost.editorExtensions,
    preview: {
      source: path,
      resolve: (targets, source) => workspace.resolveLinks(targets, source),
      assetUrl: (asset) => workspace.assetUrl(asset),
      readNote: vault.readNote,
      editNote: (note, edit) => documents.update(note, edit),
    },
    saveAttachment: (source) => workspace.saveAttachment(source, path),
    onFoldsChange: (folds) => workspace.setFolds(path, folds),
  }
}
