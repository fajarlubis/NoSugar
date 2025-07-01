package translation

type Request struct {
	Text       []string `json:"text"`
	TargetLang string   `json:"target_lang"`
	SourceLang string   `json:"source_lang"`
}

type Item struct {
	DetectedSourceLanguage string `json:"detected_source_language,omitempty"`
	Text                   string `json:"text"`
}

type Response struct {
	Translations []Item `json:"translations"`
}
