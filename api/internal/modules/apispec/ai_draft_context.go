package apispec

import (
	"encoding/json"
	"sort"
	"strconv"
	"strings"
)

const maxAIDraftReferences = 6

func deriveAIDraftConventions(specs []*APISpecPO) *APISpecAIDraftConventions {
	if len(specs) == 0 {
		return &APISpecAIDraftConventions{
			DefaultVersion:        "1.0.0",
			MethodSuccessStatuses: map[string][]string{},
		}
	}

	versionCounts := map[string]int{}
	tagCounts := map[string]int{}
	successKeyCounts := map[string]int{}
	errorKeyCounts := map[string]int{}
	methodStatuses := map[string]map[string]int{}
	publicCount := 0

	for _, spec := range specs {
		if spec == nil {
			continue
		}

		version := strings.TrimSpace(spec.Version)
		if version != "" {
			versionCounts[version]++
		}

		for _, tag := range extractSpecTags(spec) {
			tagCounts[tag]++
		}

		if spec.IsPublic {
			publicCount++
		}

		for status, resp := range extractSpecResponses(spec) {
			method := strings.ToUpper(strings.TrimSpace(spec.Method))
			if methodStatuses[method] == nil {
				methodStatuses[method] = map[string]int{}
			}
			methodStatuses[method][status]++

			keys := extractResponseSchemaKeys(resp.Schema)
			if isSuccessStatus(status) {
				for _, key := range keys {
					successKeyCounts[key]++
				}
			}
			if isErrorStatus(status) {
				for _, key := range keys {
					errorKeyCounts[key]++
				}
			}
		}
	}

	defaultVersion := "1.0.0"
	if commonVersions := topKeysByCount(versionCounts, 3); len(commonVersions) > 0 {
		defaultVersion = commonVersions[0]
	}

	authStyle := "project-auth-required"
	if publicCount == len(specs) {
		authStyle = "public"
	} else if publicCount > 0 {
		authStyle = "mixed"
	}

	result := &APISpecAIDraftConventions{
		AuthStyle:             authStyle,
		DefaultVersion:        defaultVersion,
		CommonVersions:        topKeysByCount(versionCounts, 3),
		CommonTags:            topKeysByCount(tagCounts, 8),
		SuccessEnvelopeKeys:   topKeysByCount(successKeyCounts, 5),
		ErrorEnvelopeKeys:     topKeysByCount(errorKeyCounts, 5),
		MethodSuccessStatuses: map[string][]string{},
	}

	for method, counts := range methodStatuses {
		result.MethodSuccessStatuses[method] = topKeysByCount(counts, 3)
	}

	return result
}

func selectAIDraftReferences(req *CreateAPISpecAIDraftRequest, specs []*APISpecPO) []APISpecAIDraftReference {
	if len(specs) == 0 {
		return nil
	}

	explicitIDs := make(map[uint]struct{}, len(req.ReferenceSpecIDs))
	for _, id := range req.ReferenceSpecIDs {
		explicitIDs[id] = struct{}{}
	}

	searchText := strings.Join([]string{
		req.Intent,
		strings.ToUpper(strings.TrimSpace(req.Method)),
		req.Path,
	}, " ")
	queryTokens := tokenizeSearchText(searchText)

	type candidate struct {
		ref APISpecAIDraftReference
	}

	candidates := make([]candidate, 0, len(specs))
	for _, spec := range specs {
		if spec == nil {
			continue
		}

		specTokens := tokenizeSearchText(strings.Join([]string{
			spec.Method,
			spec.Path,
			spec.Summary,
			spec.Description,
			strings.Join(extractSpecTags(spec), " "),
		}, " "))

		score := 0.0
		for token := range queryTokens {
			if _, ok := specTokens[token]; ok {
				score += 1
			}
		}

		for _, segment := range splitPathSegments(req.Path) {
			if _, ok := specTokens[segment]; ok {
				score += 0.4
			}
		}

		explicit := false
		if _, ok := explicitIDs[spec.ID]; ok {
			score += 100
			explicit = true
		}

		candidates = append(candidates, candidate{
			ref: APISpecAIDraftReference{
				ID:       spec.ID,
				Method:   spec.Method,
				Path:     spec.Path,
				Summary:  spec.Summary,
				Version:  spec.Version,
				Tags:     extractSpecTags(spec),
				Explicit: explicit,
				Score:    score,
			},
		})
	}

	sort.SliceStable(candidates, func(i, j int) bool {
		if candidates[i].ref.Score == candidates[j].ref.Score {
			return candidates[i].ref.ID > candidates[j].ref.ID
		}
		return candidates[i].ref.Score > candidates[j].ref.Score
	})

	limit := maxAIDraftReferences
	if len(candidates) < limit {
		limit = len(candidates)
	}

	references := make([]APISpecAIDraftReference, 0, limit)
	for _, item := range candidates {
		if len(references) >= limit {
			break
		}
		if item.ref.Score <= 0 && !item.ref.Explicit && len(references) > 0 {
			continue
		}
		references = append(references, item.ref)
	}

	if len(references) == 0 && len(candidates) > 0 {
		references = append(references, candidates[0].ref)
	}

	return references
}

func extractSpecTags(spec *APISpecPO) []string {
	if spec == nil || strings.TrimSpace(spec.Tags) == "" {
		return nil
	}

	var tags []string
	if err := json.Unmarshal([]byte(spec.Tags), &tags); err != nil {
		return nil
	}

	out := make([]string, 0, len(tags))
	seen := map[string]struct{}{}
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		lower := strings.ToLower(tag)
		if _, ok := seen[lower]; ok {
			continue
		}
		seen[lower] = struct{}{}
		out = append(out, tag)
	}

	return out
}

func extractSpecResponses(spec *APISpecPO) map[string]ResponseSpec {
	if spec == nil || strings.TrimSpace(spec.Responses) == "" {
		return nil
	}

	var responses map[string]ResponseSpec
	if err := json.Unmarshal([]byte(spec.Responses), &responses); err != nil {
		return nil
	}

	return responses
}

func extractResponseSchemaKeys(schema map[string]interface{}) []string {
	if len(schema) == 0 {
		return nil
	}

	properties, ok := schema["properties"].(map[string]interface{})
	if !ok || len(properties) == 0 {
		return nil
	}

	keys := make([]string, 0, len(properties))
	for key := range properties {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func topKeysByCount(counts map[string]int, limit int) []string {
	type pair struct {
		Key   string
		Count int
	}

	pairs := make([]pair, 0, len(counts))
	for key, count := range counts {
		if strings.TrimSpace(key) == "" || count <= 0 {
			continue
		}
		pairs = append(pairs, pair{Key: key, Count: count})
	}

	sort.SliceStable(pairs, func(i, j int) bool {
		if pairs[i].Count == pairs[j].Count {
			return pairs[i].Key < pairs[j].Key
		}
		return pairs[i].Count > pairs[j].Count
	})

	if len(pairs) < limit {
		limit = len(pairs)
	}

	result := make([]string, 0, limit)
	for i := 0; i < limit; i++ {
		result = append(result, pairs[i].Key)
	}
	return result
}

func tokenizeSearchText(value string) map[string]struct{} {
	normalized := strings.NewReplacer(
		"/", " ",
		"_", " ",
		"-", " ",
		"{", " ",
		"}", " ",
		":", " ",
		".", " ",
		",", " ",
		"\n", " ",
		"\t", " ",
	).Replace(strings.ToLower(value))

	result := map[string]struct{}{}
	for _, token := range strings.Fields(normalized) {
		if len(token) < 2 {
			continue
		}
		result[token] = struct{}{}
	}
	return result
}

func splitPathSegments(path string) []string {
	segments := strings.Split(strings.Trim(path, "/"), "/")
	result := make([]string, 0, len(segments))
	for _, segment := range segments {
		segment = strings.TrimSpace(segment)
		if segment == "" {
			continue
		}
		segment = strings.TrimPrefix(segment, ":")
		segment = strings.TrimPrefix(segment, "{")
		segment = strings.TrimSuffix(segment, "}")
		if len(segment) < 2 {
			continue
		}
		result = append(result, strings.ToLower(segment))
	}
	return result
}

func isSuccessStatus(status string) bool {
	code, err := strconv.Atoi(strings.TrimSpace(status))
	if err != nil {
		return false
	}
	return code >= 200 && code < 300
}

func isErrorStatus(status string) bool {
	code, err := strconv.Atoi(strings.TrimSpace(status))
	if err != nil {
		return false
	}
	return code >= 400
}
