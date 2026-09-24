use std::ops::Range;

use regex::{Regex, RegexBuilder};
use serde::Serialize;

use crate::error::{Error, Result};

const MAX_LINES_PER_NOTE: usize = 20;
const CONTEXT_BEFORE_MATCH: usize = 40;

#[derive(Debug)]
enum Field {
    Anywhere,
    Path,
    File,
    Tag,
}

#[derive(Debug)]
struct Term {
    field: Field,
    pattern: Regex,
    tag: String,
    negated: bool,
}

#[derive(Debug)]
pub struct Query {
    alternatives: Vec<Vec<Term>>,
}

pub struct Note<'a> {
    pub path: &'a str,
    pub text: &'a str,
    pub tags: &'a [String],
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Segment {
    pub text: String,
    pub highlight: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SearchLine {
    pub line: usize,
    pub segments: Vec<Segment>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SearchResult {
    pub path: String,
    pub lines: Vec<SearchLine>,
}

impl Query {
    pub fn parse(input: &str) -> Result<Self> {
        let mut alternatives = vec![Vec::new()];
        let mut rest = input.trim_start();
        while !rest.is_empty() {
            let (token, remaining) = next_token(rest)?;
            rest = remaining.trim_start();
            if token.raw == "OR" && !token.quoted {
                alternatives.push(Vec::new());
                continue;
            }
            alternatives
                .last_mut()
                .expect("there is always one alternative")
                .push(token.into_term()?);
        }
        alternatives.retain(|terms| !terms.is_empty());
        Ok(Self { alternatives })
    }

    pub fn is_empty(&self) -> bool {
        self.alternatives.is_empty()
    }

    pub fn search(&self, note: &Note) -> Option<SearchResult> {
        let matches = self
            .alternatives
            .iter()
            .any(|terms| terms.iter().all(|term| term.matches(note) != term.negated));
        matches.then(|| SearchResult {
            path: note.path.to_owned(),
            lines: self.matching_lines(note.text),
        })
    }

    fn matching_lines(&self, text: &str) -> Vec<SearchLine> {
        let patterns: Vec<&Regex> = self
            .alternatives
            .iter()
            .flatten()
            .filter(|term| !term.negated && matches!(term.field, Field::Anywhere))
            .map(|term| &term.pattern)
            .collect();
        text.lines()
            .enumerate()
            .filter_map(|(index, line)| {
                let mut ranges: Vec<Range<usize>> = patterns
                    .iter()
                    .flat_map(|pattern| pattern.find_iter(line).map(|m| m.range()))
                    .filter(|range| !range.is_empty())
                    .collect();
                (!ranges.is_empty()).then(|| {
                    ranges.sort_by_key(|range| range.start);
                    SearchLine {
                        line: index + 1,
                        segments: segments(line, &merge(ranges)),
                    }
                })
            })
            .take(MAX_LINES_PER_NOTE)
            .collect()
    }
}

impl Term {
    fn matches(&self, note: &Note) -> bool {
        match self.field {
            Field::Anywhere => self.pattern.is_match(note.text) || self.pattern.is_match(note.path),
            Field::Path => self.pattern.is_match(note.path),
            Field::File => self
                .pattern
                .is_match(note.path.rsplit('/').next().unwrap_or(note.path)),
            Field::Tag => note.tags.iter().any(|tag| {
                let tag = tag.to_lowercase();
                tag == self.tag || tag.starts_with(&format!("{}/", self.tag))
            }),
        }
    }
}

struct Token<'a> {
    raw: &'a str,
    field: Option<&'a str>,
    value: String,
    quoted: bool,
    regex: bool,
    negated: bool,
}

impl Token<'_> {
    fn into_term(self) -> Result<Term> {
        let field = match self.field {
            None => Field::Anywhere,
            Some("path") => Field::Path,
            Some("file") => Field::File,
            Some("tag") => Field::Tag,
            Some(other) => return Err(Error::InvalidQuery(format!("unknown operator {other}:"))),
        };
        let source = if self.regex {
            self.value.clone()
        } else {
            regex::escape(&self.value)
        };
        let pattern = RegexBuilder::new(&source)
            .case_insensitive(true)
            .build()
            .map_err(|error| Error::InvalidQuery(error.to_string()))?;
        Ok(Term {
            field,
            pattern,
            tag: self.value.trim_start_matches('#').to_lowercase(),
            negated: self.negated,
        })
    }
}

fn next_token(input: &str) -> Result<(Token<'_>, &str)> {
    let negated = input.starts_with('-') && input[1..].starts_with(|c: char| !c.is_whitespace());
    let body = if negated { &input[1..] } else { input };
    let (field, value_start) = match body.find(':') {
        Some(colon) if colon > 0 && body[..colon].chars().all(|c| c.is_ascii_alphabetic()) => {
            (Some(&body[..colon]), &body[colon + 1..])
        }
        _ => (None, body),
    };

    let (value, rest, quoted, regex) = match value_start.chars().next() {
        Some(delimiter @ ('"' | '/')) => {
            let inner = &value_start[1..];
            let end = find_closing(inner, delimiter)
                .ok_or_else(|| Error::InvalidQuery(format!("missing closing {delimiter}")))?;
            (
                inner[..end].to_owned(),
                &inner[end + 1..],
                delimiter == '"',
                delimiter == '/',
            )
        }
        _ => {
            let end = value_start
                .find(char::is_whitespace)
                .unwrap_or(value_start.len());
            (
                value_start[..end].to_owned(),
                &value_start[end..],
                false,
                false,
            )
        }
    };
    let raw = &input[..input.len() - rest.len()];
    Ok((
        Token {
            raw,
            field,
            value,
            quoted,
            regex,
            negated,
        },
        rest,
    ))
}

fn find_closing(text: &str, delimiter: char) -> Option<usize> {
    let mut escaped = false;
    for (index, c) in text.char_indices() {
        match c {
            '\\' if !escaped => escaped = true,
            c if c == delimiter && !escaped => return Some(index),
            _ => escaped = false,
        }
    }
    None
}

fn merge(ranges: Vec<Range<usize>>) -> Vec<Range<usize>> {
    let mut merged: Vec<Range<usize>> = Vec::new();
    for range in ranges {
        match merged.last_mut() {
            Some(last) if range.start <= last.end => last.end = last.end.max(range.end),
            _ => merged.push(range),
        }
    }
    merged
}

fn segments(line: &str, ranges: &[Range<usize>]) -> Vec<Segment> {
    let first = ranges.first().map_or(0, |range| range.start);
    let mut start = first.saturating_sub(CONTEXT_BEFORE_MATCH);
    while !line.is_char_boundary(start) {
        start -= 1;
    }
    let mut result = Vec::new();
    let mut push = |text: &str, highlight: bool| {
        if !text.is_empty() {
            result.push(Segment {
                text: text.to_owned(),
                highlight,
            });
        }
    };
    if start > 0 {
        push("…", false);
    }
    let mut cursor = start;
    for range in ranges {
        push(&line[cursor..range.start], false);
        push(&line[range.clone()], true);
        cursor = range.end;
    }
    push(&line[cursor..], false);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn note<'a>(path: &'a str, text: &'a str, tags: &'a [String]) -> Note<'a> {
        Note { path, text, tags }
    }

    fn matches(query: &str, note: &Note) -> bool {
        Query::parse(query).unwrap().search(note).is_some()
    }

    #[test]
    fn combines_terms_like_obsidian() {
        let tags = ["project/flint".to_owned()];
        let roadmap = note(
            "Plans/Roadmap.md",
            "Ship the Editor soon\nthen search",
            &tags,
        );

        assert!(matches("editor ship", &roadmap));
        assert!(matches("edit", &roadmap));
        assert!(!matches("editor missing", &roadmap));
        assert!(matches("missing OR editor", &roadmap));
        assert!(!matches("editor -search", &roadmap));
        assert!(matches("\"the editor\"", &roadmap));
        assert!(!matches("\"editor the\"", &roadmap));
        assert!(matches("/s[eh]ip?/", &roadmap));
        assert!(matches("roadmap", &roadmap));
        assert!(matches("path:plans file:road", &roadmap));
        assert!(!matches("file:plans", &roadmap));
        assert!(matches("tag:#project", &roadmap));
        assert!(matches("tag:project/flint", &roadmap));
        assert!(!matches("tag:proj", &roadmap));
    }

    #[test]
    fn highlights_matching_lines() {
        let result = Query::parse("the OR search")
            .unwrap()
            .search(&note("a.md", "no match\nthe theme\nsearch", &[]))
            .unwrap();
        let rendered: Vec<(usize, String)> = result
            .lines
            .iter()
            .map(|line| {
                let text = line
                    .segments
                    .iter()
                    .map(|s| {
                        if s.highlight {
                            format!("[{}]", s.text)
                        } else {
                            s.text.clone()
                        }
                    })
                    .collect();
                (line.line, text)
            })
            .collect();
        assert_eq!(
            rendered,
            [(2, "[the] [the]me".to_owned()), (3, "[search]".to_owned())]
        );
    }

    #[test]
    fn reports_invalid_queries() {
        assert!(Query::parse("/unclosed").is_err());
        assert!(Query::parse("/[a/").is_err());
        assert!(Query::parse("color:red").is_err());
        assert!(Query::parse("   ").unwrap().is_empty());
    }
}
