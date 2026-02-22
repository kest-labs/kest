package request

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

// RequestPO is the persistent object for HTTP requests stored in collections
type RequestPO struct {
	ID           uint           `gorm:"primaryKey"`
	CollectionID uint           `gorm:"not null;index"`
	Name         string         `gorm:"size:100;not null"`
	Description  string         `gorm:"size:500"`
	Method       string         `gorm:"size:10;not null;default:'GET'"` // GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
	URL          string         `gorm:"size:2000;not null"`             // URL with placeholders like {{base_url}}/users
	Headers      string         `gorm:"type:text"`                      // JSON array of headers
	QueryParams  string         `gorm:"type:text"`                      // JSON array of query params
	PathParams   string         `gorm:"type:text"`                      // JSON object of path params
	Body         string         `gorm:"type:text"`                      // Request body (raw/json/form-data)
	BodyType     string         `gorm:"size:20;default:'none'"`         // none, json, form-data, x-www-form-urlencoded, binary, graphql
	Auth         string         `gorm:"type:text"`                      // JSON object for auth config
	PreRequest   string         `gorm:"type:text"`                      // Pre-request script
	Test         string         `gorm:"type:text"`                      // Test script
	SortOrder    int            `gorm:"default:0"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
	DeletedAt    gorm.DeletedAt `gorm:"index"`
}

// TableName specifies the database table name
func (RequestPO) TableName() string {
	return "requests"
}

// Request is the domain entity
type Request struct {
	ID           uint                   `json:"id"`
	CollectionID uint                   `json:"collection_id"`
	Name         string                 `json:"name"`
	Description  string                 `json:"description"`
	Method       string                 `json:"method"`
	URL          string                 `json:"url"`
	Headers      []KeyValue             `json:"headers"`
	QueryParams  []KeyValue             `json:"query_params"`
	PathParams   map[string]string      `json:"path_params"`
	Body         string                 `json:"body"`
	BodyType     string                 `json:"body_type"`
	Auth         *AuthConfig            `json:"auth,omitempty"`
	PreRequest   string                 `json:"pre_request,omitempty"`
	Test         string                 `json:"test,omitempty"`
	SortOrder    int                    `json:"sort_order"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

// KeyValue represents a key-value pair with optional enabled flag
type KeyValue struct {
	Key        string `json:"key"`
	Value      string `json:"value"`
	Type       string `json:"type,omitempty"`       // text, file
	Enabled    bool   `json:"enabled,omitempty"`    // whether this header/param is active
	Description string `json:"description,omitempty"` // optional description
}

// AuthConfig represents authentication configuration
type AuthConfig struct {
	Type        string            `json:"type"` // none, basic, bearer, api-key, oauth2
	Basic       *BasicAuth        `json:"basic,omitempty"`
	Bearer      *BearerToken      `json:"bearer,omitempty"`
	APIKey      *APIKeyAuth       `json:"api_key,omitempty"`
	OAuth2      *OAuth2Config     `json:"oauth2,omitempty"`
}

type BasicAuth struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type BearerToken struct {
	Token string `json:"token"`
}

type APIKeyAuth struct {
	Key      string `json:"key"`
	Value    string `json:"value"`
	In       string `json:"in"` // header, query
	AddTo    string `json:"add_to"` // alias for In
}

type OAuth2Config struct {
	GrantType string `json:"grant_type"` // password, client_credentials, authorization_code
	AuthURL   string `json:"auth_url,omitempty"`
	TokenURL  string `json:"token_url,omitempty"`
	ClientID  string `json:"client_id,omitempty"`
	ClientSecret string `json:"client_secret,omitempty"`
	Scope     string `json:"scope,omitempty"`
	Username  string `json:"username,omitempty"`
	Password  string `json:"password,omitempty"`
}

// toDomain converts RequestPO to Request domain entity
func (po *RequestPO) toDomain() *Request {
	if po == nil {
		return nil
	}

	var headers []KeyValue
	var queryParams []KeyValue
	var pathParams map[string]string
	var bodyType string
	var auth *AuthConfig

	_ = json.Unmarshal([]byte(po.Headers), &headers)
	_ = json.Unmarshal([]byte(po.QueryParams), &queryParams)
	_ = json.Unmarshal([]byte(po.PathParams), &pathParams)
	_ = json.Unmarshal([]byte(po.Auth), &auth)

	if po.BodyType != "" {
		bodyType = po.BodyType
	} else {
		bodyType = "none"
	}

	return &Request{
		ID:           po.ID,
		CollectionID: po.CollectionID,
		Name:         po.Name,
		Description:  po.Description,
		Method:       po.Method,
		URL:          po.URL,
		Headers:      headers,
		QueryParams:  queryParams,
		PathParams:   pathParams,
		Body:         po.Body,
		BodyType:     bodyType,
		Auth:         auth,
		PreRequest:   po.PreRequest,
		Test:         po.Test,
		SortOrder:    po.SortOrder,
		CreatedAt:    po.CreatedAt,
		UpdatedAt:    po.UpdatedAt,
	}
}

// newRequestPO converts Request domain to RequestPO for database operations
func newRequestPO(r *Request) *RequestPO {
	if r == nil {
		return nil
	}

	headers, _ := json.Marshal(r.Headers)
	queryParams, _ := json.Marshal(r.QueryParams)
	pathParams, _ := json.Marshal(r.PathParams)
	auth, _ := json.Marshal(r.Auth)

	return &RequestPO{
		ID:           r.ID,
		CollectionID: r.CollectionID,
		Name:         r.Name,
		Description:  r.Description,
		Method:       r.Method,
		URL:          r.URL,
		Headers:      string(headers),
		QueryParams:  string(queryParams),
		PathParams:   string(pathParams),
		Body:         r.Body,
		BodyType:     r.BodyType,
		Auth:         string(auth),
		PreRequest:   r.PreRequest,
		Test:         r.Test,
		SortOrder:    r.SortOrder,
	}
}

// toDomainList converts a slice of RequestPO to Request slice
func toDomainList(poList []*RequestPO) []*Request {
	result := make([]*Request, len(poList))
	for i, po := range poList {
		result[i] = po.toDomain()
	}
	return result
}
