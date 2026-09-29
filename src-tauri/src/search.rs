use std::collections::HashSet;
use std::ops::Range;

use regex::{Captures, Regex, RegexBuilder};
use serde::Serialize;

use crate::error::{Error, Result};

const MAX_LINES_PER_NOTE: usize = 20;
const CONTEXT_BEFORE_MATCH: usize = 40;

/// Where a bare word is looked for, set by the operator around it.
#[derive(Debug, Clone, Copy)]
enum Field {
    /// Note text or path.
    Anywhere,
    Content,
    Path,
    File,
    Tag,
}

/// Parts of a note that `line:`, `block:`, `section:` and the task operators look within.
#[derive(Debug, Clone, Copy)]
enum Unit {
    Line,
    Block,
    Section,
    Task,
    TaskTodo,
    TaskDone,
}

#[derive(Debug)]
struct Pattern {
    regex: Regex,
    /// Regex terms expand `$1` in replacements; plain words insert them as typed.
    expands: bool,
}

#[derive(Debug)]
enum Expr {
    And(Vec<Expr>),
    Or(Vec<Expr>),
    Not(Box<Expr>),
    Term(Field, Pattern),
    /// A tag, lowercased and without `#`; it also matches its nested tags.
    Tag(String),
    Property(String, Option<Regex>),
    Within(Unit, Box<Expr>),
}

#[derive(Debug)]
pub struct Query {
    expr: Option<Expr>,
}

pub struct Note<'a> {
    pub path: &'a str,
    pub text: &'a str,
    pub tags: &'a [String],
    pub properties: &'a [(String, Vec<String>)],
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
        let mut parser = Parser { rest: input };
        let expr = parser.or(Context::default())?;
        if !parser.rest.trim_start().is_empty() {
            return Err(Error::InvalidQuery("unmatched )".to_owned()));
        }
        Ok(Self { expr })
    }

    pub fn is_empty(&self) -> bool {
        self.expr.is_none()
    }

    pub fn matches(&self, note: &Note) -> bool {
        self.expr
            .as_ref()
            .is_some_and(|expr| expr.matches(note, note.text, true))
    }

    pub fn search(&self, note: &Note) -> Option<SearchResult> {
        self.matches(note).then(|| SearchResult {
            path: note.path.to_owned(),
            lines: self.matching_lines(note),
        })
    }

    /// The terms to highlight in `note`, each limited to the lines its operators allow.
    fn highlights<'q>(&'q self, note: &Note) -> Vec<Highlight<'q>> {
        let mut highlights = Vec::new();
        if let Some(expr) = &self.expr {
            expr.collect_highlights(note, None, &mut highlights);
        }
        highlights
    }

    /// Byte ranges of the highlighted matches on the 0-based line `index`, without overlaps.
    fn ranges<'t>(
        highlights: &[Highlight],
        index: usize,
        line: &'t str,
    ) -> Vec<(Range<usize>, Captures<'t>, bool)> {
        let mut found: Vec<(Range<usize>, Captures<'t>, bool)> = highlights
            .iter()
            .filter(|highlight| {
                highlight
                    .lines
                    .as_ref()
                    .is_none_or(|lines| lines.contains(&index))
            })
            .flat_map(|highlight| {
                let expands = highlight.pattern.expands;
                highlight
                    .pattern
                    .regex
                    .captures_iter(line)
                    .map(move |captures| (captures, expands))
            })
            .filter_map(|(captures, expands)| {
                let range = captures.get(0)?.range();
                (!range.is_empty()).then_some((range, captures, expands))
            })
            .collect();
        found.sort_by_key(|(range, _, _)| (range.start, std::cmp::Reverse(range.end)));
        let mut kept: Vec<(Range<usize>, Captures<'t>, bool)> = Vec::new();
        for item in found {
            if kept
                .last()
                .is_none_or(|(last, _, _)| item.0.start >= last.end)
            {
                kept.push(item);
            }
        }
        kept
    }

    fn matching_lines(&self, note: &Note) -> Vec<SearchLine> {
        let highlights = self.highlights(note);
        note.text
            .lines()
            .enumerate()
            .filter_map(|(index, line)| {
                let ranges: Vec<Range<usize>> = Self::ranges(&highlights, index, line)
                    .into_iter()
                    .map(|(range, _, _)| range)
                    .collect();
                (!ranges.is_empty()).then(|| SearchLine {
                    line: index + 1,
                    segments: segments(line, &merge(ranges)),
                })
            })
            .take(MAX_LINES_PER_NOTE)
            .collect()
    }

    /// Replaces the highlighted matches in `text` (only on the 1-based `line`, when given) and
    /// returns the new text with the number of replacements.
    pub fn replace(&self, text: &str, replacement: &str, line: Option<usize>) -> (String, usize) {
        let note = Note {
            path: "",
            text,
            tags: &[],
            properties: &[],
        };
        let highlights = self.highlights(&note);
        let mut count = 0;
        let lines: Vec<String> = text
            .split('\n')
            .enumerate()
            .map(|(index, text)| {
                if line.is_some_and(|line| line != index + 1) {
                    return text.to_owned();
                }
                let mut result = String::with_capacity(text.len());
                let mut cursor = 0;
                for (range, captures, expands) in Self::ranges(&highlights, index, text) {
                    result.push_str(&text[cursor..range.start]);
                    if expands {
                        captures.expand(replacement, &mut result);
                    } else {
                        result.push_str(replacement);
                    }
                    cursor = range.end;
                    count += 1;
                }
                result.push_str(&text[cursor..]);
                result
            })
            .collect();
        (lines.join("\n"), count)
    }
}

/// A term to highlight, on any line or only on the 0-based `lines` its operators allow.
struct Highlight<'q> {
    pattern: &'q Pattern,
    lines: Option<HashSet<usize>>,
}

impl Expr {
    /// Whether the expression holds for `text`, a note's whole text or one of its units.
    fn matches(&self, note: &Note, text: &str, is_whole_note: bool) -> bool {
        match self {
            Self::And(parts) => parts
                .iter()
                .all(|part| part.matches(note, text, is_whole_note)),
            Self::Or(parts) => parts
                .iter()
                .any(|part| part.matches(note, text, is_whole_note)),
            Self::Not(inner) => !inner.matches(note, text, is_whole_note),
            Self::Term(field, pattern) => match field {
                Field::Anywhere => {
                    pattern.regex.is_match(text)
                        || (is_whole_note && pattern.regex.is_match(note.path))
                }
                Field::Content => pattern.regex.is_match(text),
                Field::Path => pattern.regex.is_match(note.path),
                Field::File => pattern
                    .regex
                    .is_match(note.path.rsplit('/').next().unwrap_or(note.path)),
                Field::Tag => false,
            },
            Self::Tag(wanted) => note.tags.iter().any(|tag| {
                let tag = tag.to_lowercase();
                tag == *wanted || tag.starts_with(&format!("{wanted}/"))
            }),
            Self::Property(name, value) => note.properties.iter().any(|(key, values)| {
                key.eq_ignore_ascii_case(name)
                    && value
                        .as_ref()
                        .is_none_or(|value| values.iter().any(|item| value.is_match(item)))
            }),
            Self::Within(unit, inner) => {
                units(text, *unit).any(|(_, part)| inner.matches(note, part, false))
            }
        }
    }

    /// Collects the terms to highlight; a unit operator limits its terms to the lines of the
    /// parts that satisfy it.
    fn collect_highlights<'q>(
        &'q self,
        note: &Note,
        lines: Option<&HashSet<usize>>,
        highlights: &mut Vec<Highlight<'q>>,
    ) {
        match self {
            Self::And(parts) | Self::Or(parts) => {
                for part in parts {
                    part.collect_highlights(note, lines, highlights);
                }
            }
            Self::Term(Field::Anywhere | Field::Content, pattern) => highlights.push(Highlight {
                pattern,
                lines: lines.cloned(),
            }),
            Self::Within(unit, inner) => {
                let allowed: HashSet<usize> = units(note.text, *unit)
                    .filter(|(_, part)| inner.matches(note, part, false))
                    .flat_map(|(first, part)| first..first + part.lines().count().max(1))
                    .filter(|line| lines.is_none_or(|lines| lines.contains(line)))
                    .collect();
                inner.collect_highlights(note, Some(&allowed), highlights);
            }
            Self::Not(_) | Self::Term(..) | Self::Tag(_) | Self::Property(..) => {}
        }
    }
}

fn task_state(line: &str) -> Option<(bool, &str)> {
    let trimmed = line.trim_start();
    let rest = trimmed
        .strip_prefix(['-', '*', '+'])
        .or_else(|| {
            let digits = trimmed.find(|c: char| !c.is_ascii_digit())?;
            (digits > 0)
                .then(|| trimmed[digits..].strip_prefix(['.', ')']))
                .flatten()
        })?
        .strip_prefix(' ')?;
    let mut chars = rest.chars();
    let (open, mark, close) = (chars.next()?, chars.next()?, chars.next()?);
    (open == '[' && close == ']').then(|| (mark != ' ', &rest[3..]))
}

fn is_heading(line: &str) -> bool {
    let hashes = line.len() - line.trim_start_matches('#').len();
    (1..=6).contains(&hashes) && line[hashes..].starts_with([' ', '\t'])
}

/// Splits `text` into the parts a unit operator looks within, each with its 0-based first line.
fn units(text: &str, unit: Unit) -> Box<dyn Iterator<Item = (usize, &str)> + '_> {
    match unit {
        Unit::Line => Box::new(text.lines().enumerate()),
        Unit::Task | Unit::TaskTodo | Unit::TaskDone => {
            Box::new(text.lines().enumerate().filter_map(move |(index, line)| {
                let (done, content) = task_state(line)?;
                let wanted = match unit {
                    Unit::TaskTodo => !done,
                    Unit::TaskDone => done,
                    _ => true,
                };
                wanted.then_some((index, content))
            }))
        }
        Unit::Block => Box::new(split_before(text, |line, previous| {
            line.trim().is_empty() || previous.is_some_and(|previous| previous.trim().is_empty())
        })),
        Unit::Section => Box::new(split_before(text, |line, _| is_heading(line))),
    }
}

/// Splits `text` into runs of lines, starting a new run at each line where `starts` holds.
fn split_before<'t>(
    text: &'t str,
    starts: impl Fn(&str, Option<&str>) -> bool + 't,
) -> impl Iterator<Item = (usize, &'t str)> {
    let mut runs = Vec::new();
    let (mut start, mut start_line) = (0, 0);
    let mut previous: Option<&str> = None;
    let mut offset = 0;
    for (index, line) in text.split_inclusive('\n').enumerate() {
        let content = line.trim_end_matches('\n');
        if offset > 0 && starts(content, previous) {
            runs.push((start_line, start..offset));
            (start, start_line) = (offset, index);
        }
        previous = Some(content);
        offset += line.len();
    }
    runs.push((start_line, start..text.len()));
    runs.into_iter()
        .map(move |(line, range)| (line, &text[range]))
        .filter(|(_, part)| !part.trim().is_empty())
}

#[derive(Clone, Copy)]
struct Context {
    field: Field,
    case_sensitive: bool,
}

impl Default for Context {
    fn default() -> Self {
        Self {
            field: Field::Anywhere,
            case_sensitive: false,
        }
    }
}

struct Parser<'a> {
    rest: &'a str,
}

impl Parser<'_> {
    fn peek(&mut self) -> Option<char> {
        self.rest = self.rest.trim_start();
        self.rest.chars().next()
    }

    fn at_or(&mut self) -> bool {
        self.peek();
        self.rest
            .strip_prefix("OR")
            .is_some_and(|after| after.is_empty() || after.starts_with(char::is_whitespace))
    }

    fn or(&mut self, context: Context) -> Result<Option<Expr>> {
        let mut alternatives = Vec::new();
        loop {
            if let Some(expr) = self.and(context)? {
                alternatives.push(expr);
            }
            if !self.at_or() {
                break;
            }
            self.rest = &self.rest[2..];
        }
        Ok(match alternatives.len() {
            0 => None,
            1 => alternatives.pop(),
            _ => Some(Expr::Or(alternatives)),
        })
    }

    fn and(&mut self, context: Context) -> Result<Option<Expr>> {
        let mut parts = Vec::new();
        while !matches!(self.peek(), None | Some(')')) && !self.at_or() {
            parts.push(self.unary(context)?);
        }
        Ok(match parts.len() {
            0 => None,
            1 => parts.pop(),
            _ => Some(Expr::And(parts)),
        })
    }

    fn unary(&mut self, context: Context) -> Result<Expr> {
        if let Some(after) = self.rest.strip_prefix('-')
            && after.starts_with(|c: char| !c.is_whitespace())
        {
            self.rest = after;
            return Ok(Expr::Not(Box::new(self.unary(context)?)));
        }
        self.primary(context)
    }

    fn group(&mut self, context: Context) -> Result<Expr> {
        self.rest = &self.rest[1..];
        let expr = self.or(context)?;
        if self.peek() != Some(')') {
            return Err(Error::InvalidQuery("missing closing )".to_owned()));
        }
        self.rest = &self.rest[1..];
        Ok(expr.unwrap_or(Expr::And(Vec::new())))
    }

    fn primary(&mut self, context: Context) -> Result<Expr> {
        match self.peek() {
            Some('(') => return self.group(context),
            Some('[') => return self.property(context),
            _ => {}
        }
        if let Some((name, after)) = self.rest.split_once(':') {
            let is_operator =
                !name.is_empty() && name.chars().all(|c| c.is_ascii_alphabetic() || c == '-');
            if is_operator {
                self.rest = after;
                return self.operator(name, context);
            }
        }
        self.term(context)
    }

    fn operator(&mut self, name: &str, context: Context) -> Result<Expr> {
        let with_field = |field| Context { field, ..context };
        let unit = |unit| {
            (
                unit,
                Context {
                    field: Field::Content,
                    ..context
                },
            )
        };
        let (unit, inner) = match name {
            "file" => return self.operand(with_field(Field::File)),
            "path" => return self.operand(with_field(Field::Path)),
            "content" => return self.operand(with_field(Field::Content)),
            "tag" => return self.operand(with_field(Field::Tag)),
            "match-case" => {
                return self.operand(Context {
                    case_sensitive: true,
                    ..context
                });
            }
            "ignore-case" => {
                return self.operand(Context {
                    case_sensitive: false,
                    ..context
                });
            }
            "line" => unit(Unit::Line),
            "block" => unit(Unit::Block),
            "section" => unit(Unit::Section),
            "task" => unit(Unit::Task),
            "task-todo" => unit(Unit::TaskTodo),
            "task-done" => unit(Unit::TaskDone),
            other => return Err(Error::InvalidQuery(format!("unknown operator {other}:"))),
        };
        Ok(Expr::Within(unit, Box::new(self.operand(inner)?)))
    }

    /// What follows an operator: a group in parentheses or a single term.
    fn operand(&mut self, context: Context) -> Result<Expr> {
        if self.rest.starts_with('(') {
            self.group(context)
        } else if self.rest.starts_with(char::is_whitespace) || self.rest.is_empty() {
            Err(Error::InvalidQuery("an operator needs a value".to_owned()))
        } else {
            self.term(context)
        }
    }

    fn property(&mut self, context: Context) -> Result<Expr> {
        let end = find_closing(&self.rest[1..], ']')
            .ok_or_else(|| Error::InvalidQuery("missing closing ]".to_owned()))?;
        let inside = &self.rest[1..=end];
        self.rest = &self.rest[end + 2..];
        let (name, value) = match inside.split_once(':') {
            Some((name, value)) => (name, Some(value.trim())),
            None => (inside, None),
        };
        let value = value
            .filter(|value| !value.is_empty())
            .map(|value| {
                let value = value.trim_matches('"');
                build_regex(&regex::escape(value), context.case_sensitive)
            })
            .transpose()?;
        Ok(Expr::Property(name.trim().to_owned(), value))
    }

    fn term(&mut self, context: Context) -> Result<Expr> {
        let (value, is_regex) = match self.rest.chars().next() {
            Some(delimiter @ ('"' | '/')) => {
                let inner = &self.rest[1..];
                let end = find_closing(inner, delimiter)
                    .ok_or_else(|| Error::InvalidQuery(format!("missing closing {delimiter}")))?;
                self.rest = &inner[end + 1..];
                (inner[..end].to_owned(), delimiter == '/')
            }
            _ => {
                let end = self
                    .rest
                    .find(|c: char| c.is_whitespace() || c == ')')
                    .unwrap_or(self.rest.len());
                let value = self.rest[..end].to_owned();
                self.rest = &self.rest[end..];
                (value, false)
            }
        };
        if let Field::Tag = context.field {
            return Ok(Expr::Tag(value.trim_start_matches('#').to_lowercase()));
        }
        let source = if is_regex {
            value
        } else {
            regex::escape(&value)
        };
        Ok(Expr::Term(
            context.field,
            Pattern {
                regex: build_regex(&source, context.case_sensitive)?,
                expands: is_regex,
            },
        ))
    }
}

fn build_regex(source: &str, case_sensitive: bool) -> Result<Regex> {
    RegexBuilder::new(source)
        .case_insensitive(!case_sensitive)
        .build()
        .map_err(|error| Error::InvalidQuery(error.to_string()))
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

    const NO_PROPERTIES: &[(String, Vec<String>)] = &[];

    fn note<'a>(path: &'a str, text: &'a str, tags: &'a [String]) -> Note<'a> {
        Note {
            path,
            text,
            tags,
            properties: NO_PROPERTIES,
        }
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
    fn groups_with_parentheses() {
        let text = note("a.md", "apples and pears", &[]);
        assert!(matches("(missing OR apples) pears", &text));
        assert!(!matches("(missing OR apples) -(pears)", &text));
        assert!(matches("-(missing OR absent) apples", &text));
        assert!(matches("file:(a.md OR b.md)", &text));
    }

    #[test]
    fn looks_within_lines_blocks_sections_and_tasks() {
        let text = "# One\nalpha beta\n\ngamma\n# Two\ndelta\n- [ ] buy milk\n- [x] pay rent";
        let sample = note("a.md", text, &[]);
        assert!(matches("line:(alpha beta)", &sample));
        assert!(!matches("line:(alpha gamma)", &sample));
        assert!(!matches("block:(alpha gamma)", &sample));
        assert!(matches("section:(alpha gamma)", &sample));
        assert!(!matches("section:(alpha delta)", &sample));
        assert!(matches("task:milk", &sample));
        assert!(matches("task-todo:milk", &sample));
        assert!(!matches("task-done:milk", &sample));
        assert!(matches("task-done:rent", &sample));
        assert!(!matches("task:alpha", &sample));
        assert!(matches("content:alpha", &sample));
        assert!(!matches("content:a.md", &sample));
    }

    #[test]
    fn matches_case_and_properties() {
        let properties = [
            ("status".to_owned(), vec!["Draft".to_owned()]),
            ("tags".to_owned(), vec!["a".to_owned(), "b".to_owned()]),
        ];
        let sample = Note {
            path: "a.md",
            text: "Flint notes",
            tags: &[],
            properties: &properties,
        };
        assert!(matches("match-case:Flint", &sample));
        assert!(!matches("match-case:flint", &sample));
        assert!(matches("ignore-case:FLINT", &sample));
        assert!(matches("[status]", &sample));
        assert!(matches("[Status:draft]", &sample));
        assert!(!matches("[status:final]", &sample));
        assert!(matches("[tags:b]", &sample));
        assert!(!matches("[missing]", &sample));
    }

    #[test]
    fn replaces_highlighted_matches() {
        let query = Query::parse("cat").unwrap();
        let text = "cat and Cat\nno dogs\ncat";
        assert_eq!(
            query.replace(text, "dog", None),
            ("dog and dog\nno dogs\ndog".to_owned(), 3)
        );
        assert_eq!(
            query.replace(text, "dog", Some(3)),
            ("cat and Cat\nno dogs\ndog".to_owned(), 1)
        );
        let regex = Query::parse("/(\\w+)@example/").unwrap();
        assert_eq!(
            regex.replace("mail ana@example", "$1@test", None).0,
            "mail ana@test"
        );
        assert_eq!(
            Query::parse("price")
                .unwrap()
                .replace("price", "$5", None)
                .0,
            "$5"
        );
    }

    #[test]
    fn highlights_only_where_unit_operators_hold() {
        let text = "Plant tomatoes\nWater the tomatoes\n- [ ] buy tomatoes\n- [x] eat tomatoes";
        let sample = note("a.md", text, &[]);
        let lines = |query: &str| -> Vec<usize> {
            let result = Query::parse(query).unwrap().search(&sample).unwrap();
            result.lines.iter().map(|line| line.line).collect()
        };
        assert_eq!(lines("line:(water tomatoes)"), [2]);
        assert_eq!(lines("task-todo:tomatoes"), [3]);
        assert_eq!(lines("plant line:(water tomatoes)"), [1, 2]);
        let (replaced, count) = Query::parse("task-todo:tomatoes")
            .unwrap()
            .replace(text, "beans", None);
        assert_eq!(count, 1);
        assert!(replaced.contains("buy beans") && replaced.contains("eat tomatoes"));
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
        assert!(Query::parse("(open").is_err());
        assert!(Query::parse("closed)").is_err());
        assert!(Query::parse("[status").is_err());
        assert!(Query::parse("   ").unwrap().is_empty());
    }
}
