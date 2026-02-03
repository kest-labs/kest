package cli

import (
	"reflect"
	"strings"
	"testing"
)

func TestParseMarkdown(t *testing.T) {
	content := `
# Title
Some text.

` + "```kest" + `
GET /api/v1/users
` + "```" + `

More text.

` + "```kest" + `
POST /api/v1/auth
{ "id": 1 }
` + "```" + `
`
	blocks := ParseMarkdown(content)

	if len(blocks) != 2 {
		t.Fatalf("expected 2 blocks, got %d", len(blocks))
	}

	if blocks[0].LineNum != 5 {
		t.Errorf("block 1 expected line 5, got %d", blocks[0].LineNum)
	}
	if !strings.Contains(blocks[0].Raw, "GET /api/v1/users") {
		t.Errorf("block 1 raw content mismatch")
	}

	if blocks[1].LineNum != 11 {
		t.Errorf("block 2 expected line 11, got %d", blocks[1].LineNum)
	}
}

func TestParseBlock(t *testing.T) {
	tests := []struct {
		name    string
		raw     string
		want    RequestOptions
		wantErr bool
	}{
		{
			name: "Simple GET",
			raw:  "GET /api/users",
			want: RequestOptions{
				Method: "get",
				URL:    "/api/users",
				Data:   "",
			},
			wantErr: false,
		},
		{
			name: "Post with Headers and Body",
			raw: `POST /login
Content-Type: application/json
Authorization: Bearer token

{
  "user": "admin"
}`,
			want: RequestOptions{
				Method: "post",
				URL:    "/login",
				Headers: []string{
					"Content-Type: application/json",
					"Authorization: Bearer token",
				},
				Data: "{\n  \"user\": \"admin\"\n}",
			},
			wantErr: false,
		},
		{
			name: "With Captures and Asserts",
			raw: `GET /profile
[Captures]
userId = data.id
[Asserts]
status == 200`,
			want: RequestOptions{
				Method: "get",
				URL:    "/profile",
				Captures: []string{
					"userId = data.id",
				},
				Asserts: []string{
					"status == 200",
				},
			},
			wantErr: false,
		},
		{
			name: "Complex Block with Queries and Body",
			raw: `POST /search
[Queries]
q = kest
lang = en
[Headers]
Accept: application/json
[Body]
{
  "filters": ["go", "cli"]
}
[Captures]
next_page = $.next`,
			want: RequestOptions{
				Method: "post",
				URL:    "/search",
				Queries: []string{
					"q = kest",
					"lang = en",
				},
				Headers: []string{
					"Accept: application/json",
				},
				Data: "{\n  \"filters\": [\"go\", \"cli\"]\n}",
				Captures: []string{
					"next_page = $.next",
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseBlock(tt.raw)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseBlock() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr {
				if got.Method != tt.want.Method {
					t.Errorf("Method = %v, want %v", got.Method, tt.want.Method)
				}
				if got.URL != tt.want.URL {
					t.Errorf("URL = %v, want %v", got.URL, tt.want.URL)
				}
				if !reflect.DeepEqual(got.Headers, tt.want.Headers) {
					t.Errorf("Headers = %v, want %v", got.Headers, tt.want.Headers)
				}
				if !reflect.DeepEqual(got.Captures, tt.want.Captures) {
					t.Errorf("Captures = %v, want %v", got.Captures, tt.want.Captures)
				}
				if !reflect.DeepEqual(got.Asserts, tt.want.Asserts) {
					t.Errorf("Asserts = %v, want %v", got.Asserts, tt.want.Asserts)
				}
				if strings.TrimSpace(got.Data) != strings.TrimSpace(tt.want.Data) {
					t.Errorf("Data = %v, want %v", got.Data, tt.want.Data)
				}
			}
		})
	}
}
