//! The links in JSON Canvas files: the notes and attachments their file cards show.

use std::collections::HashMap;

use serde::Serialize;
use serde_json::Value;
use serde_json::ser::PrettyFormatter;

fn file_nodes(canvas: &mut Value) -> impl Iterator<Item = &mut Value> {
    canvas
        .get_mut("nodes")
        .and_then(Value::as_array_mut)
        .into_iter()
        .flatten()
        .filter(|node| node.get("type").and_then(Value::as_str) == Some("file"))
        .filter_map(|node| node.get_mut("file"))
}

/// The vault paths of the canvas's file cards, in order and without repeats.
pub fn file_references(text: &str) -> Vec<String> {
    let Ok(mut canvas) = serde_json::from_str::<Value>(text) else {
        return Vec::new();
    };
    let mut files: Vec<String> = Vec::new();
    for file in file_nodes(&mut canvas).filter_map(|file| file.as_str()) {
        if !files.iter().any(|known| known == file) {
            files.push(file.to_owned());
        }
    }
    files
}

/// The canvas with its file cards pointing to their new paths, and how many changed.
pub fn rewrite_files(text: &str, moves: &HashMap<String, String>) -> Option<(String, usize)> {
    let mut canvas = serde_json::from_str::<Value>(text).ok()?;
    let mut changed = 0;
    for file in file_nodes(&mut canvas) {
        if let Some(new) = file.as_str().and_then(|old| moves.get(old)) {
            *file = Value::String(new.clone());
            changed += 1;
        }
    }
    if changed == 0 {
        return None;
    }
    // Tab-indented, like Obsidian writes it.
    let mut out = Vec::new();
    let mut serializer =
        serde_json::Serializer::with_formatter(&mut out, PrettyFormatter::with_indent(b"\t"));
    canvas.serialize(&mut serializer).ok()?;
    Some((String::from_utf8(out).ok()?, changed))
}

#[cfg(test)]
mod tests {
    use super::*;

    const CANVAS: &str = r##"{
	"nodes": [
		{"id": "a", "type": "file", "file": "Notes/A.md", "x": 0, "y": 0, "width": 10, "height": 10},
		{"id": "b", "type": "text", "text": "file", "x": 0, "y": 0, "width": 10, "height": 10},
		{"id": "c", "type": "file", "file": "Notes/A.md", "subpath": "#Top", "x": 0, "y": 0, "width": 10, "height": 10},
		{"id": "d", "type": "file", "file": "img.png", "x": 0, "y": 0, "width": 10, "height": 10}
	],
	"edges": [],
	"custom": 1
}"##;

    #[test]
    fn lists_file_cards_once() {
        assert_eq!(file_references(CANVAS), ["Notes/A.md", "img.png"]);
        assert!(file_references("not json").is_empty());
    }

    #[test]
    fn rewrites_moved_files_and_keeps_everything_else() {
        let moves = HashMap::from([("Notes/A.md".to_owned(), "B.md".to_owned())]);
        let (text, changed) = rewrite_files(CANVAS, &moves).unwrap();
        assert_eq!(changed, 2);
        assert_eq!(file_references(&text), ["B.md", "img.png"]);
        assert!(text.starts_with("{\n\t\"nodes\""));
        assert!(text.contains("\"subpath\": \"#Top\""));
        assert!(text.ends_with("\"custom\": 1\n}"));
        assert!(rewrite_files(CANVAS, &HashMap::new()).is_none());
    }
}
