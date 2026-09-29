use std::ops::Range;
use std::sync::LazyLock;

use percent_encoding::percent_decode_str;
use pulldown_cmark::{Event, LinkType, Options, Parser, Tag, TagEnd};
use regex::Regex;
use serde::Serialize;
use yaml_rust2::{Yaml, YamlLoader};

static EXTERNAL_URL: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|//)").expect("valid URL pattern"));
static INLINE_TAG: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?:^|\s)#([\p{L}\p{N}_/-]+)").expect("valid tag pattern"));

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WikiLink {
    pub target: String,
    pub subpath: Option<String>,
    pub alias: Option<String>,
    pub is_embed: bool,
    /// A standard `[text](path.md)` link, whose target is percent-decoded from the source.
    pub is_markdown: bool,
    pub range: Range<usize>,
    pub target_range: Range<usize>,
}

impl WikiLink {
    /// Whether `text` still holds this link's target where it was found.
    pub fn is_intact(&self, text: &str) -> bool {
        text.get(self.target_range.clone())
            .is_some_and(|raw| self.decode(raw) == self.target)
    }

    fn decode(&self, raw: &str) -> String {
        if self.is_markdown {
            percent_decode_str(raw).decode_utf8_lossy().into_owned()
        } else {
            raw.to_owned()
        }
    }
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
    pub tags: Vec<String>,
    pub aliases: Vec<String>,
    /// Frontmatter properties with their values as text, for `[property:value]` searches.
    pub properties: Vec<(String, Vec<String>)>,
}

impl NoteSummary {
    fn add_tag(&mut self, tag: &str) {
        let tag = tag.trim_start_matches('#').trim_end_matches('/');
        let is_valid = !tag.is_empty() && !tag.chars().all(|c| c.is_ascii_digit());
        let is_new = !self
            .tags
            .iter()
            .any(|known| known.eq_ignore_ascii_case(tag));
        if is_valid && is_new {
            self.tags.push(tag.to_owned());
        }
    }

    fn scan_tags(&mut self, text: &str) {
        for capture in INLINE_TAG.captures_iter(text) {
            self.add_tag(&capture[1]);
        }
    }

    fn read_frontmatter(&mut self, yaml: &str) {
        let Some(document) = YamlLoader::load_from_str(yaml)
            .ok()
            .and_then(|docs| docs.into_iter().next())
        else {
            return;
        };
        for key in ["tags", "tag"] {
            for tag in string_list(&document[key], &[',', ' ']) {
                self.add_tag(&tag);
            }
        }
        for key in ["aliases", "alias"] {
            self.aliases.extend(string_list(&document[key], &[',']));
        }
        if let Yaml::Hash(entries) = &document {
            self.properties = entries
                .iter()
                .filter_map(|(key, value)| Some((scalar_text(key)?, property_values(value))))
                .collect();
        }
    }
}

pub fn summarize(text: &str) -> NoteSummary {
    let options = Options::ENABLE_WIKILINKS
        | Options::ENABLE_YAML_STYLE_METADATA_BLOCKS
        | Options::ENABLE_MATH
        | Options::ENABLE_FOOTNOTES;
    let mut summary = NoteSummary::default();
    let mut heading: Option<Heading> = None;
    let mut prose = String::new();
    let mut frontmatter: Option<String> = None;
    let mut link_depth = 0usize;

    for (event, range) in Parser::new_ext(text, options).into_offset_iter() {
        if !matches!(event, Event::Text(_)) {
            summary.scan_tags(&prose);
            prose.clear();
        }
        match event {
            Event::Start(Tag::MetadataBlock(_)) => frontmatter = Some(String::new()),
            Event::End(TagEnd::MetadataBlock(_)) => {
                summary.read_frontmatter(&frontmatter.take().unwrap_or_default());
            }
            Event::Start(Tag::Link {
                link_type,
                dest_url,
                ..
            }) => {
                link_depth += 1;
                summary
                    .links
                    .extend(parse_link(text, range, link_type, &dest_url, false));
            }
            Event::Start(Tag::Image {
                link_type,
                dest_url,
                ..
            }) => {
                link_depth += 1;
                summary
                    .links
                    .extend(parse_link(text, range, link_type, &dest_url, true));
            }
            Event::End(TagEnd::Link) | Event::End(TagEnd::Image) => {
                link_depth = link_depth.saturating_sub(1);
            }
            Event::Start(Tag::Heading { level, .. }) => {
                heading = Some(Heading {
                    level: level as u8,
                    text: String::new(),
                });
            }
            Event::End(TagEnd::Heading(_)) => summary.headings.extend(heading.take()),
            Event::Text(content) => {
                if let Some(yaml) = &mut frontmatter {
                    yaml.push_str(&content);
                    continue;
                }
                if let Some(heading) = &mut heading {
                    heading.text.push_str(&content);
                }
                if link_depth == 0 {
                    prose.push_str(&content);
                }
            }
            Event::Code(content) => {
                if let Some(heading) = &mut heading {
                    heading.text.push_str(&content);
                }
            }
            _ => {}
        }
    }
    summary.scan_tags(&prose);
    summary
}

fn string_list(value: &Yaml, separators: &[char]) -> Vec<String> {
    let items: Vec<String> = match value {
        Yaml::Array(items) => items.iter().filter_map(scalar_text).collect(),
        other => scalar_text(other)
            .map(|text| text.split(separators).map(str::to_owned).collect())
            .unwrap_or_default(),
    };
    items
        .iter()
        .map(|item| item.trim().to_owned())
        .filter(|item| !item.is_empty())
        .collect()
}

fn property_values(value: &Yaml) -> Vec<String> {
    match value {
        Yaml::Array(items) => items.iter().filter_map(scalar_text).collect(),
        other => scalar_text(other).into_iter().collect(),
    }
}

/// The note's frontmatter as JSON, keeping its values' types, for Bases.
pub fn frontmatter_json(text: &str) -> serde_json::Map<String, serde_json::Value> {
    let body = text
        .strip_prefix("---\n")
        .or_else(|| text.strip_prefix("---\r\n"));
    let yaml = body.and_then(|body| {
        let end = body.find("\n---")?;
        Some(&body[..end])
    });
    let document = yaml
        .and_then(|yaml| YamlLoader::load_from_str(yaml).ok())
        .and_then(|docs| docs.into_iter().next());
    match document.map(|document| yaml_json(&document)) {
        Some(serde_json::Value::Object(map)) => map,
        _ => serde_json::Map::new(),
    }
}

fn yaml_json(value: &Yaml) -> serde_json::Value {
    use serde_json::Value;
    match value {
        Yaml::String(text) => Value::String(text.clone()),
        Yaml::Integer(number) => Value::from(*number),
        Yaml::Real(text) => text
            .parse::<f64>()
            .ok()
            .and_then(serde_json::Number::from_f64)
            .map_or_else(|| Value::String(text.clone()), Value::Number),
        Yaml::Boolean(value) => Value::Bool(*value),
        Yaml::Array(items) => Value::Array(items.iter().map(yaml_json).collect()),
        Yaml::Hash(entries) => Value::Object(
            entries
                .iter()
                .filter_map(|(key, value)| Some((scalar_text(key)?, yaml_json(value))))
                .collect(),
        ),
        _ => Value::Null,
    }
}

fn scalar_text(value: &Yaml) -> Option<String> {
    match value {
        Yaml::String(text) | Yaml::Real(text) => Some(text.clone()),
        Yaml::Integer(number) => Some(number.to_string()),
        Yaml::Boolean(value) => Some(value.to_string()),
        _ => None,
    }
}

fn parse_link(
    text: &str,
    range: Range<usize>,
    link_type: LinkType,
    destination: &str,
    is_embed: bool,
) -> Option<WikiLink> {
    match link_type {
        LinkType::WikiLink { .. } => parse_wikilink(text, range),
        LinkType::Inline => parse_markdown_link(text, range, destination, is_embed),
        _ => None,
    }
}

fn parse_markdown_link(
    text: &str,
    range: Range<usize>,
    destination: &str,
    is_embed: bool,
) -> Option<WikiLink> {
    if destination.is_empty() || EXTERNAL_URL.is_match(destination) {
        return None;
    }
    let raw_path = destination
        .split_once('#')
        .map_or(destination, |(path, _)| path);
    let source = &text[range.clone()];
    let start = range.start + source.rfind(destination)?;
    let decode = |raw: &str| percent_decode_str(raw).decode_utf8_lossy().into_owned();
    Some(WikiLink {
        target: decode(raw_path),
        subpath: destination
            .split_once('#')
            .map(|(_, subpath)| decode(subpath)),
        alias: None,
        is_embed,
        is_markdown: true,
        target_range: start..start + raw_path.len(),
        range,
    })
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
        is_markdown: false,
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
    fn extracts_local_markdown_links_and_images() {
        let text = "[a](Other%20Note.md#Part) ![p](<img one.png>) [w](https://x.com/a.md) [r][ref]\n\n[ref]: Ref.md\n";
        let links = summarize(text).links;
        let described: Vec<_> = links
            .iter()
            .map(|link| {
                (
                    link.target.as_str(),
                    link.subpath.as_deref(),
                    &text[link.target_range.clone()],
                    link.is_embed,
                )
            })
            .collect();
        assert_eq!(
            described,
            [
                ("Other Note.md", Some("Part"), "Other%20Note.md", false),
                ("img one.png", None, "img one.png", true),
            ]
        );
        assert!(
            links
                .iter()
                .all(|link| link.is_markdown && link.is_intact(text))
        );
    }

    #[test]
    fn ignores_wikilinks_in_code() {
        let text = "`[[inline]]`\n\n```\n[[fenced]]\n```\n";
        assert!(summarize(text).links.is_empty());
    }

    #[test]
    fn collects_inline_tags_outside_code_links_and_urls() {
        let text = "#start and #Nested/tag, #123 #v2 #start\n\n`#code` [#label](https://x.com/#anchor) [[#heading]]\n\n# Heading #inHeading\n";
        assert_eq!(
            summarize(text).tags,
            ["start", "Nested/tag", "v2", "inHeading"]
        );
    }

    #[test]
    fn ignores_tags_and_links_in_math() {
        let text = "$#x + [[inline]]$ #real\n\n$$\n#y [[block]]\n$$\n";
        let summary = summarize(text);
        assert_eq!(summary.tags, ["real"]);
        assert!(summary.links.is_empty());
    }

    #[test]
    fn converts_frontmatter_to_json() {
        let json = frontmatter_json(
            "---\nstatus: draft\nrating: 4\nscore: 1.5\ndone: true\nitems: [a, b]\n---\nbody",
        );
        assert_eq!(
            serde_json::Value::Object(json),
            serde_json::json!({"status": "draft", "rating": 4, "score": 1.5, "done": true, "items": ["a", "b"]})
        );
        assert!(frontmatter_json("no frontmatter").is_empty());
    }

    #[test]
    fn reads_tags_and_aliases_from_frontmatter() {
        let text =
            "---\ntags: [project, \"#flint\"]\naliases: First, Second\n---\n\nBody #inline\n";
        let summary = summarize(text);
        assert_eq!(summary.tags, ["project", "flint", "inline"]);
        assert_eq!(summary.aliases, ["First", "Second"]);

        let text = "---\ntags: one two\nalias: Only\n---\n";
        let summary = summarize(text);
        assert_eq!(summary.tags, ["one", "two"]);
        assert_eq!(summary.aliases, ["Only"]);
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
