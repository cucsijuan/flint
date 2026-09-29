use std::ops::Range;
use std::sync::LazyLock;

use regex::{Regex, RegexBuilder};

/// Text where a note name is already a link or isn't prose: links, inline code and URLs.
static LINKED: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\[\[[^\]]*\]\]|\[[^\]]*\]\([^)]*\)|`[^`]*`|[a-zA-Z][a-zA-Z0-9+.-]*://\S+")
        .expect("valid pattern")
});

/// A plain-text mention of a name, which could become a link.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Found {
    /// 1-based.
    pub line: usize,
    /// The mention as written.
    pub text: String,
    pub context: String,
}

fn name_pattern(name: &str) -> Option<Regex> {
    let source = format!(
        r"(?:^|[^\p{{L}}\p{{N}}_])({})(?:[^\p{{L}}\p{{N}}_]|$)",
        regex::escape(name)
    );
    RegexBuilder::new(&source)
        .case_insensitive(true)
        .build()
        .ok()
}

/// The lines of `text` worth scanning for mentions: no frontmatter and no code blocks.
fn prose_lines(text: &str) -> impl Iterator<Item = (usize, &str)> {
    let has_frontmatter = text.starts_with("---\n") || text.starts_with("---\r\n");
    let mut in_frontmatter = has_frontmatter;
    let mut in_code = false;
    text.lines().enumerate().filter_map(move |(index, line)| {
        if in_frontmatter {
            if index > 0 && line.trim_end() == "---" {
                in_frontmatter = false;
            }
            return None;
        }
        let trimmed = line.trim_start();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            in_code = !in_code;
            return None;
        }
        (!in_code).then_some((index + 1, line))
    })
}

/// The first unlinked mention of any of `names` on each line of `text`.
pub fn find(text: &str, names: &[String]) -> Vec<Found> {
    let lowered = text.to_lowercase();
    let patterns: Vec<Regex> = names
        .iter()
        .filter(|name| !name.is_empty() && lowered.contains(&name.to_lowercase()))
        .filter_map(|name| name_pattern(name))
        .collect();
    if patterns.is_empty() {
        return Vec::new();
    }
    prose_lines(text)
        .filter_map(|(line, content)| {
            let linked: Vec<Range<usize>> = LINKED
                .find_iter(content)
                .map(|found| found.range())
                .collect();
            let is_linked = |range: &Range<usize>| {
                linked
                    .iter()
                    .any(|span| range.start < span.end && span.start < range.end)
            };
            patterns
                .iter()
                .flat_map(|pattern| pattern.captures_iter(content))
                .filter_map(|captures| captures.get(1))
                .filter(|found| !is_linked(&found.range()))
                .min_by_key(|found| found.start())
                .map(|found| Found {
                    line,
                    text: found.as_str().to_owned(),
                    context: content.trim().to_owned(),
                })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(names: &[&str]) -> Vec<String> {
        names.iter().map(|name| (*name).to_owned()).collect()
    }

    #[test]
    fn finds_whole_word_mentions_outside_links_and_code() {
        let text = "---\ntitle: Flint\n---\nI use flint daily.\n[[Flint]] is linked.\nFlintstone no.\n```\nflint\n```\n`flint` and https://flint.dev/x, but also Flint.";
        let found = find(text, &names(&["Flint"]));
        let lines: Vec<(usize, &str)> = found.iter().map(|f| (f.line, f.text.as_str())).collect();
        assert_eq!(lines, [(4, "flint"), (10, "Flint")]);
    }

    #[test]
    fn matches_aliases_and_names_with_symbols() {
        let text = "Learning C++ and the editor";
        let found = find(text, &names(&["C++", "Editor"]));
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].text, "C++");
    }
}
