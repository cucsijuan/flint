import type { CodeBlockProcessor, Disposer, PostProcessor } from '../../../plugin-api'

class Processors {
  /** Bumps whenever a processor is added or removed, so rendered content can refresh. */
  version = $state(0)
  post: PostProcessor[] = []
  #codeBlocks = new Map<string, CodeBlockProcessor>()

  addPostProcessor(processor: PostProcessor): Disposer {
    this.post = [...this.post, processor]
    this.version++
    return () => {
      this.post = this.post.filter((known) => known !== processor)
      this.version++
    }
  }

  addCodeBlockProcessor(language: string, processor: CodeBlockProcessor): Disposer {
    const key = language.toLowerCase()
    this.#codeBlocks.set(key, processor)
    this.version++
    return () => {
      if (this.#codeBlocks.get(key) === processor) this.#codeBlocks.delete(key)
      this.version++
    }
  }

  codeBlock(language: string) {
    return this.#codeBlocks.get(language.toLowerCase())
  }
}

export const processors = new Processors()
