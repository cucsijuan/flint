use std::cmp::Reverse;
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};

use serde::Serialize;

use crate::error::Result;
use crate::markdown::{Heading, WikiLink, summarize};
use crate::search::{Note, Query, SearchResult};
use crate::vault::{EntryKind, Vault, is_attachment_name, is_within, parent_of};

const NOTE_EXTENSION: &str = ".md";

#[derive(Debug, Clone)]
struct IndexedLink {
    link: WikiLink,
    line: usize,
    context: String,
}

#[derive(Debug, Clone, Default)]
struct IndexedNote {
    text: String,
    links: Vec<IndexedLink>,
    headings: Vec<Heading>,
    tags: Vec<String>,
    aliases: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Backlink {
    pub source: String,
    pub line: usize,
    pub context: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkTarget {
    pub path: String,
    pub link_text: String,
    pub alias: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeKind {
    Note,
    Tag,
    Unresolved,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub kind: NodeKind,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct GraphLink {
    pub source: String,
    pub target: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct Graph {
    pub nodes: Vec<GraphNode>,
    pub links: Vec<GraphLink>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TagCount {
    pub tag: String,
    pub count: usize,
}

#[derive(Debug, Default)]
pub struct Index {
    notes: BTreeMap<String, IndexedNote>,
    attachments: BTreeSet<String>,
}

impl Index {
    pub fn build(vault: &Vault) -> Result<Self> {
        let mut index = Self::default();
        index.refresh(vault, "")?;
        Ok(index)
    }

    pub fn refresh(&mut self, vault: &Vault, path: &str) -> Result<()> {
        self.notes.retain(|note, _| !is_within(note, path));
        self.attachments
            .retain(|attachment| !is_within(attachment, path));
        for entry in vault.entries_under(path)? {
            match entry.kind {
                EntryKind::File => {
                    let text = vault.read(&entry.path)?;
                    self.insert(entry.path, &text);
                }
                EntryKind::Attachment => {
                    self.attachments.insert(entry.path);
                }
                EntryKind::Folder => {}
            }
        }
        Ok(())
    }

    pub fn insert(&mut self, path: String, text: &str) {
        let summary = summarize(text);
        let links = summary
            .links
            .into_iter()
            .map(|link| {
                let line_start = text[..link.range.start].rfind('\n').map_or(0, |i| i + 1);
                let line_end = text[link.range.end..]
                    .find('\n')
                    .map_or(text.len(), |i| link.range.end + i);
                IndexedLink {
                    line: text[..line_start].matches('\n').count() + 1,
                    context: text[line_start..line_end].trim().to_owned(),
                    link,
                }
            })
            .collect();
        self.notes.insert(
            path,
            IndexedNote {
                text: text.to_owned(),
                links,
                headings: summary.headings,
                tags: summary.tags,
                aliases: summary.aliases,
            },
        );
    }

    pub fn resolve(&self, source: &str, target: &str) -> Option<String> {
        let target = target.trim().trim_start_matches('/');
        if is_attachment_name(target) {
            return self.resolve_attachment(source, target);
        }
        let wanted = note_key(target);
        if wanted.is_empty() {
            return self.notes.contains_key(source).then(|| source.to_owned());
        }
        if let Some(exact) = self.notes.keys().find(|path| note_key(path) == wanted) {
            return Some(exact.clone());
        }
        let suffix = format!("/{wanted}");
        let source_folder = parent_of(source);
        let closest = |paths: Vec<&String>| {
            paths
                .into_iter()
                .min_by_key(|path| (Reverse(parent_of(path) == source_folder), path.len(), *path))
                .cloned()
        };
        let by_name = self
            .notes
            .keys()
            .filter(|path| note_key(path).ends_with(&suffix))
            .collect();
        closest(by_name).or_else(|| {
            let by_alias = self
                .notes
                .iter()
                .filter(|(_, note)| {
                    note.aliases
                        .iter()
                        .any(|alias| alias.to_lowercase() == wanted)
                })
                .map(|(path, _)| path)
                .collect();
            closest(by_alias)
        })
    }

    fn resolve_attachment(&self, source: &str, target: &str) -> Option<String> {
        let wanted = target.to_lowercase();
        let suffix = format!("/{wanted}");
        let source_folder = parent_of(source);
        self.attachments
            .iter()
            .filter(|path| {
                let path = path.to_lowercase();
                path == wanted || path.ends_with(&suffix)
            })
            .min_by_key(|path| (Reverse(parent_of(path) == source_folder), path.len(), *path))
            .cloned()
    }

    pub fn link_text(&self, path: &str) -> String {
        if self.attachments.contains(path) {
            let name = path.rsplit('/').next().unwrap_or(path);
            let shares_name = self
                .attachments
                .iter()
                .filter(|other| {
                    other
                        .rsplit('/')
                        .next()
                        .is_some_and(|other| other.eq_ignore_ascii_case(name))
                })
                .count()
                > 1;
            return if shares_name { path } else { name }.to_owned();
        }
        let without_extension = strip_note_extension(path);
        let name = without_extension
            .rsplit('/')
            .next()
            .unwrap_or(without_extension);
        let name_key = name.to_lowercase();
        let shares_name = self
            .notes
            .keys()
            .filter(|other| note_key(other).rsplit('/').next() == Some(name_key.as_str()))
            .count()
            > 1;
        if shares_name { without_extension } else { name }.to_owned()
    }

    pub fn link_targets(&self) -> Vec<LinkTarget> {
        self.notes
            .iter()
            .flat_map(|(path, note)| {
                let link_text = self.link_text(path);
                let aliases = note.aliases.iter().cloned().map(Some);
                std::iter::once(None)
                    .chain(aliases)
                    .map(move |alias| LinkTarget {
                        path: path.clone(),
                        link_text: link_text.clone(),
                        alias,
                    })
            })
            .chain(self.attachments.iter().map(|path| LinkTarget {
                path: path.clone(),
                link_text: self.link_text(path),
                alias: None,
            }))
            .collect()
    }

    pub fn tags(&self) -> Vec<TagCount> {
        let mut counts: BTreeMap<String, (String, usize)> = BTreeMap::new();
        for note in self.notes.values() {
            let mut seen = HashSet::new();
            for tag in &note.tags {
                for (end, _) in tag
                    .match_indices('/')
                    .chain(std::iter::once((tag.len(), "")))
                {
                    let tag = &tag[..end];
                    if seen.insert(tag.to_lowercase()) {
                        counts
                            .entry(tag.to_lowercase())
                            .or_insert_with(|| (tag.to_owned(), 0))
                            .1 += 1;
                    }
                }
            }
        }
        counts
            .into_values()
            .map(|(tag, count)| TagCount { tag, count })
            .collect()
    }

    pub fn graph(&self) -> Graph {
        let mut nodes: BTreeMap<String, GraphNode> = self
            .notes
            .keys()
            .map(|path| {
                let label = strip_note_extension(path)
                    .rsplit('/')
                    .next()
                    .unwrap_or(path);
                let node = GraphNode {
                    id: path.clone(),
                    label: label.to_owned(),
                    kind: NodeKind::Note,
                };
                (path.clone(), node)
            })
            .collect();
        let mut links = BTreeSet::new();
        let mut connect = |source: &str, target: String| {
            if source != target.as_str() {
                links.insert((source.to_owned(), target));
            }
        };

        for (source, note) in &self.notes {
            for link in &note.links {
                if link.link.target.is_empty() {
                    continue;
                }
                let target = match self.resolve(source, &link.link.target) {
                    Some(target) if self.attachments.contains(&target) => continue,
                    Some(target) => target,
                    None => {
                        let id = format!("?{}", note_key(link.link.target.trim()));
                        nodes.entry(id.clone()).or_insert_with(|| GraphNode {
                            id: id.clone(),
                            label: link.link.target.trim().to_owned(),
                            kind: NodeKind::Unresolved,
                        });
                        id
                    }
                };
                connect(source, target);
            }
            for tag in &note.tags {
                let id = format!("#{}", tag.to_lowercase());
                nodes.entry(id.clone()).or_insert_with(|| GraphNode {
                    id: id.clone(),
                    label: format!("#{tag}"),
                    kind: NodeKind::Tag,
                });
                connect(source, id);
            }
        }

        Graph {
            nodes: nodes.into_values().collect(),
            links: links
                .into_iter()
                .map(|(source, target)| GraphLink { source, target })
                .collect(),
        }
    }

    pub fn search(&self, query: &str) -> Result<Vec<SearchResult>> {
        let query = Query::parse(query)?;
        if query.is_empty() {
            return Ok(Vec::new());
        }
        Ok(self
            .notes
            .iter()
            .filter_map(|(path, note)| {
                query.search(&Note {
                    path,
                    text: &note.text,
                    tags: &note.tags,
                })
            })
            .collect())
    }

    pub fn headings(&self, path: &str) -> Vec<Heading> {
        self.notes
            .get(path)
            .map(|note| note.headings.clone())
            .unwrap_or_default()
    }

    pub fn backlinks(&self, path: &str) -> Vec<Backlink> {
        self.incoming(|target| target == path)
            .into_iter()
            .map(|(source, link)| Backlink {
                source: source.to_owned(),
                line: link.line,
                context: link.context.clone(),
            })
            .collect()
    }

    pub fn incoming_link_count(&self, path: &str) -> usize {
        self.incoming(|target| is_within(target, path)).len()
    }

    pub fn update_links_for_rename(
        &mut self,
        vault: &Vault,
        from: &str,
        to: &str,
    ) -> Result<usize> {
        let moves: HashMap<String, String> = self
            .notes
            .keys()
            .chain(&self.attachments)
            .filter(|path| is_within(path, from))
            .map(|path| (path.clone(), format!("{to}{}", &path[from.len()..])))
            .collect();

        let mut rewrites: BTreeMap<String, Vec<(WikiLink, String)>> = BTreeMap::new();
        for (source, link) in self.incoming(|target| moves.contains_key(target)) {
            let target = self.resolve(source, &link.link.target).unwrap_or_default();
            rewrites
                .entry(source.to_owned())
                .or_default()
                .push((link.link.clone(), moves[&target].clone()));
        }

        vault.rename(from, to)?;
        for (old, new) in &moves {
            if let Some(note) = self.notes.remove(old) {
                self.notes.insert(new.clone(), note);
            }
            if self.attachments.remove(old) {
                self.attachments.insert(new.clone());
            }
        }

        let mut updated = 0;
        for (source, links) in rewrites {
            let source = moves.get(&source).cloned().unwrap_or(source);
            let mut text = vault.read(&source)?;
            let mut links = links;
            links.sort_by_key(|(link, _)| Reverse(link.target_range.start));
            for (link, new_target) in &links {
                if text.get(link.target_range.clone()) == Some(link.target.as_str()) {
                    text.replace_range(link.target_range.clone(), &self.link_text(new_target));
                    updated += 1;
                }
            }
            vault.write(&source, &text)?;
            self.insert(source, &text);
        }
        Ok(updated)
    }

    fn incoming(&self, matches: impl Fn(&str) -> bool) -> Vec<(&str, &IndexedLink)> {
        let mut found = Vec::new();
        for (source, note) in &self.notes {
            for link in &note.links {
                let target = (!link.link.target.is_empty())
                    .then(|| self.resolve(source, &link.link.target))
                    .flatten();
                if target.is_some_and(|target| matches(&target)) {
                    found.push((source.as_str(), link));
                }
            }
        }
        found
    }
}

fn strip_note_extension(path: &str) -> &str {
    let split = path.len().saturating_sub(NOTE_EXTENSION.len());
    match path.get(split..) {
        Some(extension) if extension.eq_ignore_ascii_case(NOTE_EXTENSION) => &path[..split],
        _ => path,
    }
}

fn note_key(path: &str) -> String {
    strip_note_extension(path).to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn index_of(notes: &[(&str, &str)]) -> Index {
        let mut index = Index::default();
        for (path, text) in notes {
            index.insert((*path).to_owned(), text);
        }
        index
    }

    #[test]
    fn resolves_links_like_obsidian() {
        let index = index_of(&[
            ("Note.md", ""),
            ("a/Shared.md", ""),
            ("b/Shared.md", ""),
            ("b/deep/Shared.md", ""),
        ]);

        assert_eq!(index.resolve("x.md", "note").as_deref(), Some("Note.md"));
        assert_eq!(index.resolve("x.md", "Note.md").as_deref(), Some("Note.md"));
        assert_eq!(
            index.resolve("x.md", "b/Shared").as_deref(),
            Some("b/Shared.md")
        );
        assert_eq!(
            index.resolve("x.md", "deep/Shared").as_deref(),
            Some("b/deep/Shared.md")
        );
        assert_eq!(
            index.resolve("b/deep/x.md", "Shared").as_deref(),
            Some("b/deep/Shared.md")
        );
        assert_eq!(
            index.resolve("x.md", "Shared").as_deref(),
            Some("a/Shared.md")
        );
        assert_eq!(index.resolve("x.md", "Missing"), None);
        assert_eq!(index.resolve("Note.md", "").as_deref(), Some("Note.md"));
    }

    #[test]
    fn resolves_frontmatter_aliases_after_names() {
        let index = index_of(&[
            ("Long Name.md", "---\naliases: [Short]\n---\n"),
            ("Short.md", ""),
            ("Other.md", "---\naliases: Nick\n---\n"),
        ]);
        assert_eq!(index.resolve("x.md", "short").as_deref(), Some("Short.md"));
        assert_eq!(index.resolve("x.md", "nick").as_deref(), Some("Other.md"));
        let aliases: Vec<_> = index
            .link_targets()
            .into_iter()
            .filter_map(|target| Some((target.path, target.alias?)))
            .collect();
        assert_eq!(
            aliases,
            [
                ("Long Name.md".to_owned(), "Short".to_owned()),
                ("Other.md".to_owned(), "Nick".to_owned())
            ]
        );
    }

    #[test]
    fn counts_notes_per_tag_including_parents() {
        let index = index_of(&[
            ("a.md", "#project/flint #Project"),
            ("b.md", "#project/other"),
            ("c.md", "#solo"),
        ]);
        let counts: Vec<_> = index
            .tags()
            .into_iter()
            .map(|tag| (tag.tag, tag.count))
            .collect();
        assert_eq!(
            counts,
            [
                ("project".to_owned(), 2),
                ("project/flint".to_owned(), 1),
                ("project/other".to_owned(), 1),
                ("solo".to_owned(), 1)
            ]
        );
    }

    #[test]
    fn builds_a_graph_of_notes_tags_and_unresolved_links() {
        let index = index_of(&[
            (
                "a.md",
                "[[b]] [[b#Part]] [[Missing]] [[missing]] [[#Self]] [[a]] #Topic",
            ),
            ("folder/b.md", "#topic"),
            ("orphan.md", ""),
        ]);
        let graph = index.graph();

        let nodes: Vec<_> = graph
            .nodes
            .iter()
            .map(|node| (node.id.as_str(), node.label.as_str(), node.kind.clone()))
            .collect();
        assert_eq!(
            nodes,
            [
                ("#topic", "#Topic", NodeKind::Tag),
                ("?missing", "Missing", NodeKind::Unresolved),
                ("a.md", "a", NodeKind::Note),
                ("folder/b.md", "b", NodeKind::Note),
                ("orphan.md", "orphan", NodeKind::Note),
            ]
        );
        let links: Vec<_> = graph
            .links
            .iter()
            .map(|link| (link.source.as_str(), link.target.as_str()))
            .collect();
        assert_eq!(
            links,
            [
                ("a.md", "#topic"),
                ("a.md", "?missing"),
                ("a.md", "folder/b.md"),
                ("folder/b.md", "#topic"),
            ]
        );
    }

    #[test]
    fn resolves_and_renames_attachments() {
        let dir = TempDir::new().unwrap();
        let vault = Vault::open(dir.path()).unwrap();
        vault.create_folder("assets").unwrap();
        vault.create_file("assets/Photo.PNG", b"png").unwrap();
        vault.create_file("other.png", b"png").unwrap();
        vault
            .write(
                "Note.md",
                "![[photo.png]] ![[assets/Photo.PNG|small]] [[Missing.png]]",
            )
            .unwrap();
        let mut index = Index::build(&vault).unwrap();

        assert_eq!(
            index.resolve("Note.md", "photo.png").as_deref(),
            Some("assets/Photo.PNG")
        );
        assert_eq!(index.resolve("Note.md", "Missing.png"), None);
        assert_eq!(index.link_text("assets/Photo.PNG"), "Photo.PNG");
        assert!(
            index
                .graph()
                .links
                .iter()
                .all(|link| link.target != "assets/Photo.PNG")
        );

        let updated = index
            .update_links_for_rename(&vault, "assets/Photo.PNG", "assets/Cover.png")
            .unwrap();
        assert_eq!(updated, 2);
        assert_eq!(
            vault.read("Note.md").unwrap(),
            "![[Cover.png]] ![[Cover.png|small]] [[Missing.png]]"
        );
    }

    #[test]
    fn uses_the_shortest_unambiguous_link_text() {
        let index = index_of(&[("Unique.md", ""), ("a/Shared.md", ""), ("b/Shared.md", "")]);
        assert_eq!(index.link_text("Unique.md"), "Unique");
        assert_eq!(index.link_text("a/Shared.md"), "a/Shared");
    }

    #[test]
    fn finds_backlinks_with_their_line_and_context() {
        let index = index_of(&[
            ("Target.md", "[[#Self]]"),
            (
                "Source.md",
                "intro\nsee [[Target]] and [[target|again]]\n[[Other]]",
            ),
        ]);

        let context = "see [[Target]] and [[target|again]]";
        let backlink = |line| Backlink {
            source: "Source.md".into(),
            line,
            context: context.into(),
        };
        assert_eq!(index.backlinks("Target.md"), [backlink(2), backlink(2)]);
        assert_eq!(index.incoming_link_count("Target.md"), 2);
    }

    #[test]
    fn rename_rewrites_links_and_keeps_subpaths_and_aliases() {
        let dir = TempDir::new().unwrap();
        let vault = Vault::open(dir.path()).unwrap();
        vault.create_folder("folder").unwrap();
        vault.write("folder/Old.md", "# Part").unwrap();
        vault.write("folder/Sibling.md", "[[Old]]").unwrap();
        vault
            .write(
                "Source.md",
                "[[Old#Part|alias]] ![[folder/Old]] [[Other]] `[[Old]]`",
            )
            .unwrap();
        let mut index = Index::build(&vault).unwrap();

        let updated = index
            .update_links_for_rename(&vault, "folder", "renamed")
            .unwrap();
        assert_eq!(updated, 3);

        let updated = index
            .update_links_for_rename(&vault, "renamed/Old.md", "renamed/New.md")
            .unwrap();
        assert_eq!(updated, 3);

        assert_eq!(
            vault.read("Source.md").unwrap(),
            "[[New#Part|alias]] ![[New]] [[Other]] `[[Old]]`"
        );
        assert_eq!(vault.read("renamed/Sibling.md").unwrap(), "[[New]]");
        assert_eq!(index.backlinks("renamed/New.md").len(), 3);
    }
}
