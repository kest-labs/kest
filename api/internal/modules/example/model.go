package example

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

// ExamplePO is the persistent object for request examples
type ExamplePO struct {
	ID          uint           `gorm:"primaryKey"`
	RequestID   uint           `gorm:"not null;index"`
	Name        string         `gorm:"size:100;not null"`
	Description string         `gorm:"size:500"`
	URL         string         `gorm:"size:2000"` // Resolved URL with variables
	Method      string         `gorm:"size:10"`
	Headers     string         `gorm:"type:text"`    // JSON array
	QueryParams string         `gorm:"type:text"`    // JSON array
	Body        string         `gorm:"type:text"`    // Request body
	BodyType    string         `gorm:"size:20"`      // none, json, form-data
	Auth        string         `gorm:"type:text"`    // JSON object

	// Response
	ResponseStatus  int    `gorm:"default:0"`   // HTTP status code
	ResponseHeaders string `gorm:"type:text"`    // JSON object
	ResponseBody    string `gorm:"type:text"`    // Response body
	ResponseTime    int64  `gorm:"default:0"`    // Response time in ms

	IsDefault bool `gorm:"default:false"`
	SortOrder int  `gorm:"default:0"`

	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

// TableName specifies the database table name
func (ExamplePO) TableName() string {
	return "examples"
}

// Example is the domain entity
type Example struct {
	ID              uint                   `json:"id"`
	RequestID       uint                   `json:"request_id"`
	Name            string                 `json:"name"`
	Description     string                 `json:"description"`
	URL             string                 `json:"url"`
	Method          string                 `json:"method"`
	Headers         []KeyValue             `json:"headers"`
	QueryParams     []KeyValue             `json:"query_params"`
	Body            string                 `json:"body"`
	BodyType        string                 `json:"body_type"`
	Auth            *AuthConfig            `json:"auth,omitempty"`

	// Response
	ResponseStatus  int               `json:"response_status"`
	ResponseHeaders map[string]string `json:"response_headers"`
	ResponseBody    string            `json:"response_body"`
	ResponseTime    int64             `json:"response_time"`

	IsDefault bool   `json:"is_default"`
	SortOrder int    `json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type KeyValue struct {
	Key        string `json:"key"`
	Value      string `json:"value"`
	Type       string `json:"type,omitempty"`
	Enabled    bool   `json:"enabled,omitempty"`
	Description string `json:"description,omitempty"`
}

type AuthConfig struct {
	Type        string     `json:"type"`
	Basic       *BasicAuth `json:"basic,omitempty"`
	Bearer      *BearerToken `json:"bearer,omitempty"`
	APIKey      *APIKeyAuth `json:"api_key,omitempty"`
	OAuth2      *OAuth2Config `json:"oauth2,omitempty"`
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
	In       string `json:"in"`
	AddTo    string `json:"add_to"`
}

type OAuth2Config struct {
	GrantType    string `json:"grant_type"`
	AuthURL      string `json:"auth_url,omitempty"`
	TokenURL     string `json:"token_url,omitempty"`
	ClientID     string `json:"client_id,omitempty"`
	ClientSecret string `json:"client_secret,omitempty"`
	Scope        string `json:"scope,omitempty"`
	Username     string `json:"username,omitempty"`
	Password     string `json:"password,omitempty"`
}

// toDomain converts ExamplePO to Example domain entity
func (po *ExamplePO) toDomain() *Example {
	if po == nil {
		return nil
	}

	var headers []KeyValue
	var queryParams []KeyValue
	var auth *AuthConfig
	var responseHeaders map[string]string

	_ = json.Unmarshal([]byte(po.Headers), &headers)
	_ = json.Unmarshal([]byte(po.QueryParams), &queryParams)
	_ = json.Unmarshal([]byte(po.Auth), &auth)
	_ = json.Unmarshal([]byte(po.ResponseHeaders), &responseHeaders)

	bodyType := po.BodyType
	if bodyType == "" {
		bodyType = "none"
	}

	return &Example{
		ID:              po.ID,
		RequestID:       po.RequestID,
		Name:            po.Name,
		Description:     po.Description,
		URL:             po.URL,
		Method:          po.Method,
		Headers:         headers,
		QueryParams:     queryParams,
		Body:            po.Body,
		BodyType:        bodyType,
		Auth:            auth,
		ResponseStatus:  po.ResponseStatus,
		ResponseHeaders: responseHeaders,
		ResponseBody:    po.ResponseBody,
		ResponseTime:    po.ResponseTime,
		IsDefault:       po.IsDefault,
		SortOrder:       po.SortOrder,
		CreatedAt:       po.CreatedAt,
		UpdatedAt:       po.UpdatedAt,
	}
}

// newExamplePO converts Example domain to ExamplePO for database operations
func newExamplePO(e *Example) *ExamplePO {
	if e == nil {
		return nil
	}

	headers, _ := json.Marshal(e.Headers)
	queryParams, _ := json.Marshal(e.QueryParams)
	auth, _ := json.Marshal(e.Auth)
	responseHeaders, _ := json.Marshal(e.ResponseHeaders)

	return &ExamplePO{
		ID:              e.ID,
		RequestID:       e.RequestID,
		Name:            e.Name,
		Description:     e.Description,
		URL:             e.URL,
		Method:          e.Method,
		Headers:         string(headers),
		QueryParams:     string(queryParams),
		Body:            e.Body,
		BodyType:        e.BodyType,
		Auth:            string(auth),
		ResponseStatus:  e.ResponseStatus,
		ResponseHeaders: string(responseHeaders),
		ResponseBody:    e.ResponseBody,
		ResponseTime:    e.ResponseTime,
		IsDefault:       e.IsDefault,
		SortOrder:       e.SortOrder,
	}
}

// toDomainList converts a slice of ExamplePO to Example slice
func toDomainList(poList []*ExamplePO) []*Example {
	result := make([]*Example, len(poList))
	for i, po := range poList {
		result[i] = po.toDomain()
	}
	return result
}
