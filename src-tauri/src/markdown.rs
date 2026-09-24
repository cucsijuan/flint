use std::ops::Range;

use pulldown_cmark::{Event, LinkType, Options, Parser, Tag, TagEnd};
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WikiLink {
    pub target: String,
    pub subpath: Option<String>,
    pub alias: Option<String>,
    pub is_embed: bool,
    pub range: Range<usize>,
    pub target_range: Range<usize>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Heading {
    pub level: u8,
    pub text: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct NoteSummary {
    pub links: Vec<WikiLink>,
    pub headings: Vec<Heading>,
}

pub fn summarize(text: &str) -> NoteSummary {
    let mut summary = NoteSummary::default();
    let mut heading: Option<Heading> = None;

    for (event, range) in Parser::new_ext(text, Options::ENABLE_WIKILINKS).into_offset_iter() {
        match event {
            Event::Start(Tag::Link {
                link_type: LinkType::WikiLink { .. },
                ..
            })
            | Event::Start(Tag::Image {
                link_type: LinkType::WikiLink { .. },
                ..
            }) => summary.links.extend(parse_wikilink(text, range)),
            Event::Start(Tag::Heading { level, .. }) => {
                heading = Some(Heading {
                    level: level as u8,
                    text: String::new(),
                });
            }
            Event::Text(content) | Event::Code(content) => {
                if let Some(heading) = &mut heading {
                    heading.text.push_str(&content);
                }
            }
            Event::End(TagEnd::Heading(_)) => summary.headings.extend(heading.take()),
            _ => {}
        }
    }
    summary
}

fn parse_wikilink(text: &str, range: Range<usize>) -> Option<WikiLink> {
    let source = &text[range.clone()];
    let is_embed = source.starts_with('!');
    let open = if is_embed { "![[" } else { "[[" };
    let inner = source.strip_prefix(open)?.strip_suffix("]]")?;
    let (destination, alias) = match inner.split_once('|') {
        Some((destination, alias)) => (destination, Some(alias.to_owned())),
        None => (inner, None),
    };
    let (target, subpath) = match destination.split_once('#') {
        Some((target, subpath)) => (target, Some(subpath.to_owned())),
        None => (destination, None),
    };
    let target_start = range.start + open.len();
    Some(WikiLink {
        target: target.to_owned(),
        subpath,
        alias,
        is_embed,
        target_range: target_start..target_start + target.len(),
        range,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_wikilinks_with_subpaths_aliases_and_embeds() {
        let text = "See [[Note]], [[Folder/Other#Part|shown]] and ![[Image]].";
        let links = summarize(text).links;

        let described: Vec<_> = links
            .iter()
            .map(|link| {
                (
                    &text[link.target_range.clone()],
                    link.subpath.as_deref(),
                    link.alias.as_deref(),
                    link.is_embed,
                )
            })
            .collect();
        assert_eq!(
            described,
            [
                ("Note", None, None, false),
                ("Folder/Other", Some("Part"), Some("shown"), false),
                ("Image", None, None, true),
            ]
        );
        assert_eq!(&text[links[2].range.clone()], "![[Image]]");
    }

    #[test]
    fn ignores_wikilinks_in_code() {
        let text = "`[[inline]]`\n\n```\n[[fenced]]\n```\n";
        assert!(summarize(text).links.is_empty());
    }

    #[test]
    fn collects_headings() {
        let text = "# Title\n\ntext\n\n## Sub `code`\n";
        let headings = summarize(text).headings;
        assert_eq!(
            headings,
            [
                Heading {
                    level: 1,
                    text: "Title".into()
                },
                Heading {
                    level: 2,
                    text: "Sub code".into()
                },
            ]
        );
    }
}
