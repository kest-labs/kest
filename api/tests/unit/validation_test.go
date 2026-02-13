package unit

import (
	"testing"

	"github.com/kest-labs/kest/api/pkg/validation"
	"github.com/go-playground/validator/v10"
)

func TestValidation_Required(t *testing.T) {
	type User struct {
		Name  string `json:"name" validate:"required"`
		Email string `json:"email" validate:"required"`
	}

	errs := validation.Validate(User{})

	if errs.IsEmpty() {
		t.Error("Expected validation errors for empty struct")
	}

	if !errs.Has("name") {
		t.Error("Expected error for 'name' field")
	}

	if !errs.Has("email") {
		t.Error("Expected error for 'email' field")
	}
}

func TestValidation_Email(t *testing.T) {
	type User struct {
		Email string `json:"email" validate:"required,email"`
	}

	// Invalid email
	errs := validation.Validate(User{Email: "not-an-email"})
	if !errs.Has("email") {
		t.Error("Expected error for invalid email")
	}

	// Valid email
	errs = validation.Validate(User{Email: "test@example.com"})
	if !errs.IsEmpty() {
		t.Errorf("Expected no errors for valid email, got: %v", errs)
	}
}

func TestValidation_MinMax(t *testing.T) {
	type Input struct {
		Name string `json:"name" validate:"min=3,max=10"`
		Age  int    `json:"age" validate:"min=18,max=100"`
	}

	// Too short name
	errs := validation.Validate(Input{Name: "ab", Age: 25})
	if !errs.Has("name") {
		t.Error("Expected error for name too short")
	}

	// Too long name
	errs = validation.Validate(Input{Name: "verylongname", Age: 25})
	if !errs.Has("name") {
		t.Error("Expected error for name too long")
	}

	// Age too low
	errs = validation.Validate(Input{Name: "john", Age: 15})
	if !errs.Has("age") {
		t.Error("Expected error for age too low")
	}

	// Valid input
	errs = validation.Validate(Input{Name: "john", Age: 25})
	if !errs.IsEmpty() {
		t.Errorf("Expected no errors for valid input, got: %v", errs)
	}
}

func TestValidation_Phone(t *testing.T) {
	type Contact struct {
		Phone string `json:"phone" validate:"phone"`
	}

	testCases := []struct {
		phone   string
		isValid bool
	}{
		{"13812345678", true},
		{"15912345678", true},
		{"12345678901", false},  // Doesn't start with 13-19
		{"1381234567", false},   // Too short
		{"138123456789", false}, // Too long
		{"abc", false},
	}

	for _, tc := range testCases {
		errs := validation.Validate(Contact{Phone: tc.phone})
		if tc.isValid && !errs.IsEmpty() {
			t.Errorf("Phone '%s' should be valid, got errors: %v", tc.phone, errs)
		}
		if !tc.isValid && errs.IsEmpty() {
			t.Errorf("Phone '%s' should be invalid", tc.phone)
		}
	}
}

func TestValidation_Username(t *testing.T) {
	type User struct {
		Username string `json:"username" validate:"username"`
	}

	testCases := []struct {
		username string
		isValid  bool
	}{
		{"john_doe", true},
		{"user123", true},
		{"a", false},         // Too short
		{"123user", false},   // Starts with number
		{"user@name", false}, // Invalid character
	}

	for _, tc := range testCases {
		errs := validation.Validate(User{Username: tc.username})
		if tc.isValid && !errs.IsEmpty() {
			t.Errorf("Username '%s' should be valid, got errors: %v", tc.username, errs)
		}
		if !tc.isValid && errs.IsEmpty() {
			t.Errorf("Username '%s' should be invalid", tc.username)
		}
	}
}

func TestValidation_Password(t *testing.T) {
	type Auth struct {
		Password string `json:"password" validate:"password"`
	}

	testCases := []struct {
		password string
		isValid  bool
	}{
		{"Password1", true},
		{"MyP@ss123", true},
		{"password", false},  // No uppercase or digit
		{"PASSWORD1", false}, // No lowercase
		{"Passw1", false},    // Too short
	}

	for _, tc := range testCases {
		errs := validation.Validate(Auth{Password: tc.password})
		if tc.isValid && !errs.IsEmpty() {
			t.Errorf("Password '%s' should be valid, got errors: %v", tc.password, errs)
		}
		if !tc.isValid && errs.IsEmpty() {
			t.Errorf("Password '%s' should be invalid", tc.password)
		}
	}
}

func TestValidation_StrongPassword(t *testing.T) {
	type Auth struct {
		Password string `json:"password" validate:"password_strong"`
	}

	testCases := []struct {
		password string
		isValid  bool
	}{
		{"MyP@ss123", true},
		{"Str0ng!Pass", true},
		{"Password1", false}, // No special char
		{"password!", false}, // No uppercase or digit
		{"P@ss1", false},     // Too short
	}

	for _, tc := range testCases {
		errs := validation.Validate(Auth{Password: tc.password})
		if tc.isValid && !errs.IsEmpty() {
			t.Errorf("Strong password '%s' should be valid, got errors: %v", tc.password, errs)
		}
		if !tc.isValid && errs.IsEmpty() {
			t.Errorf("Strong password '%s' should be invalid", tc.password)
		}
	}
}

func TestValidation_Slug(t *testing.T) {
	type Post struct {
		Slug string `json:"slug" validate:"slug"`
	}

	testCases := []struct {
		slug    string
		isValid bool
	}{
		{"hello-world", true},
		{"my-post-123", true},
		{"simple", true},
		{"Hello-World", false}, // Uppercase
		{"hello_world", false}, // Underscore
		{"-hello", false},      // Starts with hyphen
	}

	for _, tc := range testCases {
		errs := validation.Validate(Post{Slug: tc.slug})
		if tc.isValid && !errs.IsEmpty() {
			t.Errorf("Slug '%s' should be valid, got errors: %v", tc.slug, errs)
		}
		if !tc.isValid && errs.IsEmpty() {
			t.Errorf("Slug '%s' should be invalid", tc.slug)
		}
	}
}

func TestValidation_SafeString(t *testing.T) {
	type Input struct {
		Content string `json:"content" validate:"safe_string"`
	}

	testCases := []struct {
		content string
		isValid bool
	}{
		{"Hello, world!", true},
		{"Normal text content", true},
		{"<script>alert('xss')</script>", false},
		{"<iframe src='evil.com'></iframe>", false},
		{"javascript:alert(1)", false},
		{"onclick=alert(1)", false},
	}

	for _, tc := range testCases {
		errs := validation.Validate(Input{Content: tc.content})
		if tc.isValid && !errs.IsEmpty() {
			t.Errorf("Content '%s' should be safe, got errors: %v", tc.content, errs)
		}
		if !tc.isValid && errs.IsEmpty() {
			t.Errorf("Content '%s' should be unsafe", tc.content)
		}
	}
}

func TestValidation_Positive(t *testing.T) {
	type Item struct {
		Quantity int     `json:"quantity" validate:"positive"`
		Price    float64 `json:"price" validate:"positive"`
	}

	// Valid positive numbers
	errs := validation.Validate(Item{Quantity: 5, Price: 9.99})
	if !errs.IsEmpty() {
		t.Errorf("Expected no errors for positive numbers, got: %v", errs)
	}

	// Zero is not positive
	errs = validation.Validate(Item{Quantity: 0, Price: 9.99})
	if !errs.Has("quantity") {
		t.Error("Expected error for zero quantity")
	}

	// Negative number
	errs = validation.Validate(Item{Quantity: -1, Price: 9.99})
	if !errs.Has("quantity") {
		t.Error("Expected error for negative quantity")
	}
}

func TestValidation_Domain(t *testing.T) {
	type Site struct {
		Domain string `json:"domain" validate:"domain"`
	}

	testCases := []struct {
		domain  string
		isValid bool
	}{
		{"example.com", true},
		{"sub.example.com", true},
		{"my-site.co.uk", true},
		{"localhost", false},
		{"example", false},
		{".example.com", false},
	}

	for _, tc := range testCases {
		errs := validation.Validate(Site{Domain: tc.domain})
		if tc.isValid && !errs.IsEmpty() {
			t.Errorf("Domain '%s' should be valid, got errors: %v", tc.domain, errs)
		}
		if !tc.isValid && errs.IsEmpty() {
			t.Errorf("Domain '%s' should be invalid", tc.domain)
		}
	}
}

func TestValidation_ErrorsMethods(t *testing.T) {
	type User struct {
		Name  string `json:"name" validate:"required,min=3"`
		Email string `json:"email" validate:"required,email"`
		Age   int    `json:"age" validate:"required,min=18"`
	}

	errs := validation.Validate(User{Name: "ab", Email: "invalid", Age: 10})

	// Test Error()
	errStr := errs.Error()
	if errStr == "" {
		t.Error("Error() should return non-empty string")
	}

	// Test First()
	first := errs.First()
	if first == "" {
		t.Error("First() should return first error message")
	}

	// Test FirstField()
	firstField := errs.FirstField()
	if firstField == "" {
		t.Error("FirstField() should return first field name")
	}

	// Test Fields()
	fields := errs.Fields()
	if len(fields) < 2 {
		t.Errorf("Expected at least 2 fields with errors, got %d", len(fields))
	}

	// Test ToMap()
	errMap := errs.ToMap()
	if len(errMap) == 0 {
		t.Error("ToMap() should return non-empty map")
	}

	// Test ToSimpleMap()
	simpleMap := errs.ToSimpleMap()
	if len(simpleMap) == 0 {
		t.Error("ToSimpleMap() should return non-empty map")
	}
}

func TestValidation_CustomRule(t *testing.T) {
	v := validation.New()

	// Register custom rule
	err := v.RegisterRule("even", func(fl validator.FieldLevel) bool {
		return fl.Field().Int()%2 == 0
	}, "must be an even number")

	if err != nil {
		t.Fatalf("Failed to register custom rule: %v", err)
	}

	type Number struct {
		Value int `json:"value" validate:"even"`
	}

	// Even number should pass
	errs := v.Validate(Number{Value: 4})
	if !errs.IsEmpty() {
		t.Errorf("Even number should pass validation, got: %v", errs)
	}

	// Odd number should fail
	errs = v.Validate(Number{Value: 3})
	if errs.IsEmpty() {
		t.Error("Odd number should fail validation")
	}
}

func TestValidation_CustomMessage(t *testing.T) {
	v := validation.New()

	// Set custom message
	v.SetMessage("required", ":field cannot be empty")

	type User struct {
		Name string `json:"name" validate:"required"`
	}

	errs := v.Validate(User{})
	if errs.IsEmpty() {
		t.Fatal("Expected validation error")
	}

	msg := errs.First()
	if msg != "name cannot be empty" {
		t.Errorf("Expected custom message, got: %s", msg)
	}
}

func TestValidation_SetMessages(t *testing.T) {
	v := validation.New()

	v.SetMessages(map[string]string{
		"required": ":field is mandatory",
		"email":    ":field format is invalid",
	})

	type User struct {
		Name  string `json:"name" validate:"required"`
		Email string `json:"email" validate:"required,email"`
	}

	errs := v.Validate(User{Email: "invalid"})

	nameErr := errs.Get("name")
	if len(nameErr) == 0 || nameErr[0].Message != "name is mandatory" {
		t.Errorf("Expected custom required message, got: %v", nameErr)
	}

	emailErr := errs.Get("email")
	hasEmailFormatErr := false
	for _, e := range emailErr {
		if e.Message == "email format is invalid" {
			hasEmailFormatErr = true
			break
		}
	}
	if !hasEmailFormatErr {
		t.Errorf("Expected custom email message, got: %v", emailErr)
	}
}

func TestValidation_ValidateVar(t *testing.T) {
	// Valid email
	err := validation.ValidateVar("test@example.com", "required,email")
	if err != nil {
		t.Errorf("Expected no error for valid email, got: %v", err)
	}

	// Invalid email
	err = validation.ValidateVar("not-an-email", "required,email")
	if err == nil {
		t.Error("Expected error for invalid email")
	}

	// Valid number
	err = validation.ValidateVar(25, "required,min=18,max=100")
	if err != nil {
		t.Errorf("Expected no error for valid number, got: %v", err)
	}

	// Invalid number
	err = validation.ValidateVar(15, "required,min=18")
	if err == nil {
		t.Error("Expected error for number below min")
	}
}

func TestValidation_Oneof(t *testing.T) {
	type Status struct {
		Value string `json:"value" validate:"oneof=pending active completed"`
	}

	// Valid value
	errs := validation.Validate(Status{Value: "active"})
	if !errs.IsEmpty() {
		t.Errorf("Expected no errors for valid oneof value, got: %v", errs)
	}

	// Invalid value
	errs = validation.Validate(Status{Value: "invalid"})
	if errs.IsEmpty() {
		t.Error("Expected error for invalid oneof value")
	}
}

func TestValidation_Nested(t *testing.T) {
	type Address struct {
		City    string `json:"city" validate:"required"`
		ZipCode string `json:"zip_code" validate:"required,len=6"`
	}

	type User struct {
		Name    string  `json:"name" validate:"required"`
		Address Address `json:"address" validate:"required"`
	}

	// Invalid nested struct
	errs := validation.Validate(User{Name: "John", Address: Address{City: ""}})
	if errs.IsEmpty() {
		t.Error("Expected validation errors for invalid nested struct")
	}
}

func TestValidation_NoWhitespace(t *testing.T) {
	type Input struct {
		Code string `json:"code" validate:"no_whitespace"`
	}

	testCases := []struct {
		code    string
		isValid bool
	}{
		{"ABC123", true},
		{"no-spaces", true},
		{"has space", false},
		{"has\ttab", false},
		{"has\nnewline", false},
	}

	for _, tc := range testCases {
		errs := validation.Validate(Input{Code: tc.code})
		if tc.isValid && !errs.IsEmpty() {
			t.Errorf("Code '%s' should be valid, got errors: %v", tc.code, errs)
		}
		if !tc.isValid && errs.IsEmpty() {
			t.Errorf("Code '%s' should be invalid", tc.code)
		}
	}
}

func TestValidation_Trimmed(t *testing.T) {
	type Input struct {
		Value string `json:"value" validate:"trimmed"`
	}

	testCases := []struct {
		value   string
		isValid bool
	}{
		{"trimmed", true},
		{"also trimmed", true},
		{" leading space", false},
		{"trailing space ", false},
		{" both sides ", false},
	}

	for _, tc := range testCases {
		errs := validation.Validate(Input{Value: tc.value})
		if tc.isValid && !errs.IsEmpty() {
			t.Errorf("Value '%s' should be valid, got errors: %v", tc.value, errs)
		}
		if !tc.isValid && errs.IsEmpty() {
			t.Errorf("Value '%s' should be invalid", tc.value)
		}
	}
}
