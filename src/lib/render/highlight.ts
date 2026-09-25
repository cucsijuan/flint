import { LanguageDescription } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { classHighlighter, highlightCode } from '@lezer/highlight'

export async function highlightBlock(code: HTMLElement) {
  const name = /language-(\S+)/.exec(code.className)?.[1]
  const description = name && LanguageDescription.matchLanguageName(languages, name, true)
  if (!description) return
  const { language } = await description.load()
  const text = code.textContent ?? ''
  const fragment = document.createDocumentFragment()
  highlightCode(
    text,
    language.parser.parse(text),
    classHighlighter,
    (content, classes) => {
      fragment.append(
        classes
          ? Object.assign(document.createElement('span'), {
              className: classes,
              textContent: content,
            })
          : content,
      )
    },
    () => fragment.append('\n'),
  )
  code.replaceChildren(fragment)
}
