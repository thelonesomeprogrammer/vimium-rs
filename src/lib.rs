use regex::RegexBuilder;
use serde::Serialize;
use wasm_bindgen::prelude::*;

const DEFAULT_ALPHABET: &[u8] = b"abcdefghijklmnopqrstuvwxyz";

#[derive(Serialize)]
struct HintLabel {
    index: usize,
    label: String,
}

#[derive(Serialize)]
struct RegexMatch {
    index: usize,
    text: String,
}

#[wasm_bindgen]
pub struct VimiumCore {
    mode: String,
    hints: Vec<String>,
}

#[wasm_bindgen]
impl VimiumCore {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            mode: "normal".to_string(),
            hints: Vec::new(),
        }
    }

    pub fn set_mode(&mut self, mode: &str) {
        self.mode = mode.to_string();
    }

    pub fn mode(&self) -> String {
        self.mode.clone()
    }

    pub fn generate_hints(&mut self, count: usize) -> Result<JsValue, JsValue> {
        self.hints = generate_hint_labels(count);
        let entries: Vec<HintLabel> = self
            .hints
            .iter()
            .enumerate()
            .map(|(index, label)| HintLabel {
                index,
                label: label.clone(),
            })
            .collect();
        serde_wasm_bindgen::to_value(&entries).map_err(to_js_error)
    }

    pub fn filter_hints(&self, prefix: &str) -> Result<JsValue, JsValue> {
        let entries = filter_hint_labels(&self.hints, prefix);
        serde_wasm_bindgen::to_value(&entries).map_err(to_js_error)
    }

    pub fn resolve_hint(&self, input: &str) -> i32 {
        let normalized = input.trim().to_lowercase();
        self.hints
            .iter()
            .position(|label| label == &normalized)
            .map(|index| index as i32)
            .unwrap_or(-1)
    }

    pub fn match_regex(&self, pattern: &str, texts: JsValue) -> Result<JsValue, JsValue> {
        let values: Vec<String> = serde_wasm_bindgen::from_value(texts).map_err(to_js_error)?;
        let matches = regex_match_texts(pattern, &values)?;
        serde_wasm_bindgen::to_value(&matches).map_err(to_js_error)
    }
}

fn filter_hint_labels(hints: &[String], prefix: &str) -> Vec<HintLabel> {
    let normalized = prefix.trim().to_lowercase();
    hints
        .iter()
        .enumerate()
        .filter_map(|(index, label)| {
            if label.starts_with(&normalized) {
                Some(HintLabel {
                    index,
                    label: label.clone(),
                })
            } else {
                None
            }
        })
        .collect()
}

fn regex_match_texts(pattern: &str, values: &[String]) -> Result<Vec<RegexMatch>, JsValue> {
        let regex = RegexBuilder::new(pattern)
            .case_insensitive(true)
            .size_limit(1_000_000)
            .dfa_size_limit(1_000_000)
            .build()
            .map_err(to_js_error)?;

        Ok(values
            .iter()
            .enumerate()
            .filter_map(|(index, text)| {
                if regex.is_match(text) {
                    Some(RegexMatch {
                        index,
                        text: text.clone(),
                    })
                } else {
                    None
                }
            })
            .collect())
}

fn generate_hint_labels(count: usize) -> Vec<String> {
    if count == 0 {
        return Vec::new();
    }

    let base = DEFAULT_ALPHABET.len();
    let mut width = 1usize;
    while base.pow(width as u32) < count {
        width += 1;
    }

    (0..count).map(|n| encode_hint(n, width, DEFAULT_ALPHABET)).collect()
}

fn encode_hint(mut value: usize, width: usize, alphabet: &[u8]) -> String {
    let base = alphabet.len();
    let mut chars = vec![alphabet[0] as char; width];
    for index in (0..width).rev() {
        chars[index] = alphabet[value % base] as char;
        value /= base;
    }
    chars.into_iter().collect()
}

fn to_js_error<E: ToString>(err: E) -> JsValue {
    JsValue::from_str(&err.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_unique_hint_labels() {
        let hints = generate_hint_labels(30);
        assert_eq!(hints.len(), 30);
        assert_eq!(hints[0], "aa");
        assert_eq!(hints[1], "ab");
        assert_eq!(hints[25], "az");
        assert_eq!(hints[26], "ba");
    }

    #[test]
    fn resolves_exact_hint() {
        let hints = generate_hint_labels(4);
        assert_eq!(hints[0], "a");
        assert_eq!(hints[1], "b");
        let filtered = filter_hint_labels(&hints, "b");
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].index, 1);
        assert_eq!(filtered[0].label, "b");
    }

    #[test]
    fn regex_matching_works() {
        let texts = vec![
            "Open Settings".to_string(),
            "Help Center".to_string(),
            "Docs".to_string(),
        ];
        let matches = regex_match_texts("help|docs", &texts).unwrap();
        assert_eq!(matches.len(), 2);
        assert_eq!(matches[0].index, 1);
        assert_eq!(matches[1].index, 2);
    }
}
