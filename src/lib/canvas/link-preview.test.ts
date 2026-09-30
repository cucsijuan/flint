// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { parseLinkPreview } from './link-preview'

describe('parseLinkPreview', () => {
  it('prefers Open Graph tags and resolves relative images', () => {
    const html = `<html><head><title>Plain</title>
      <meta property="og:title" content="Rich title">
      <meta name="description" content="About the page">
      <meta property="og:image" content="/cover.png">
      </head></html>`
    expect(parseLinkPreview(html, 'https://www.example.com/post')).toEqual({
      title: 'Rich title',
      description: 'About the page',
      image: 'https://www.example.com/cover.png',
      site: 'example.com',
    })
  })

  it('falls back to the page title and the host', () => {
    expect(parseLinkPreview('<title> Page </title>', 'https://a.org').title).toBe('Page')
    expect(parseLinkPreview('', 'https://a.org')).toMatchObject({ title: 'a.org', image: null })
  })
})
