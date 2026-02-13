package integration

import (
	"context"
	"testing"

	"github.com/kest-labs/kest/api/internal/infra/notification"
)

// TestNotification implements Notification interface
type TestNotification struct {
	Title   string
	Message string
}

func (n *TestNotification) Via(notifiable notification.Notifiable) []string {
	return []string{"log"}
}

// TestUser implements Notifiable interface
type TestUser struct {
	ID      uint
	Email   string
	Phone   string
	SlackID string
}

func (u *TestUser) RouteNotificationFor(channel string) string {
	switch channel {
	case "mail":
		return u.Email
	case "sms":
		return u.Phone
	case "slack":
		return u.SlackID
	default:
		return ""
	}
}

func (u *TestUser) GetID() interface{} {
	return u.ID
}

func TestNotification_Send(t *testing.T) {
	manager := notification.New()
	logChannel := notification.NewLogChannel()
	manager.RegisterChannel("log", logChannel)

	user := &TestUser{
		ID:    1,
		Email: "test@example.com",
	}

	notif := &TestNotification{
		Title:   "Test",
		Message: "Hello",
	}

	ctx := context.Background()
	err := manager.Send(ctx, user, notif)
	if err != nil {
		t.Fatalf("Send failed: %v", err)
	}

	if logChannel.Count() != 1 {
		t.Errorf("Expected 1 logged message, got %d", logChannel.Count())
	}
}

func TestLogChannel_Clear(t *testing.T) {
	logChannel := notification.NewLogChannel()

	// Add some messages manually
	ctx := context.Background()
	user := &TestUser{ID: 1}
	notif := &TestNotification{Title: "Test"}

	logChannel.Send(ctx, user, notif)
	logChannel.Send(ctx, user, notif)

	if logChannel.Count() != 2 {
		t.Errorf("Expected 2 messages, got %d", logChannel.Count())
	}

	logChannel.Clear()

	if logChannel.Count() != 0 {
		t.Errorf("Expected 0 messages after clear, got %d", logChannel.Count())
	}
}

func TestMailMessage(t *testing.T) {
	msg := notification.NewMailMessage().
		SetSubject("Test Subject").
		SetFrom("sender@example.com").
		SetTo("recipient@example.com").
		SetBody("Plain text body").
		SetHTMLBody("<h1>HTML body</h1>").
		AddCC("cc@example.com").
		AddBCC("bcc@example.com").
		SetHeader("X-Custom", "value")

	if msg.Subject != "Test Subject" {
		t.Errorf("Expected subject 'Test Subject', got '%s'", msg.Subject)
	}
	if msg.From != "sender@example.com" {
		t.Errorf("Expected from 'sender@example.com', got '%s'", msg.From)
	}
	if len(msg.To) != 1 || msg.To[0] != "recipient@example.com" {
		t.Errorf("Expected to ['recipient@example.com'], got %v", msg.To)
	}
	if msg.Body != "Plain text body" {
		t.Errorf("Expected body 'Plain text body', got '%s'", msg.Body)
	}
	if msg.HTMLBody != "<h1>HTML body</h1>" {
		t.Errorf("Expected HTML body '<h1>HTML body</h1>', got '%s'", msg.HTMLBody)
	}
	if len(msg.CC) != 1 {
		t.Errorf("Expected 1 CC, got %d", len(msg.CC))
	}
	if len(msg.BCC) != 1 {
		t.Errorf("Expected 1 BCC, got %d", len(msg.BCC))
	}
	if msg.Headers["X-Custom"] != "value" {
		t.Errorf("Expected header 'X-Custom' = 'value', got '%s'", msg.Headers["X-Custom"])
	}
}

func TestMailMessage_Attach(t *testing.T) {
	msg := notification.NewMailMessage().
		Attach("file.txt", []byte("content"), "text/plain")

	if len(msg.Attachments) != 1 {
		t.Errorf("Expected 1 attachment, got %d", len(msg.Attachments))
	}
	if msg.Attachments[0].Name != "file.txt" {
		t.Errorf("Expected attachment name 'file.txt', got '%s'", msg.Attachments[0].Name)
	}
}

func TestSMSMessage(t *testing.T) {
	msg := notification.NewSMSMessage("Hello SMS").
		SetTo("+1234567890").
		SetFrom("MyApp")

	if msg.Content != "Hello SMS" {
		t.Errorf("Expected content 'Hello SMS', got '%s'", msg.Content)
	}
	if msg.To != "+1234567890" {
		t.Errorf("Expected to '+1234567890', got '%s'", msg.To)
	}
	if msg.From != "MyApp" {
		t.Errorf("Expected from 'MyApp', got '%s'", msg.From)
	}
}

func TestSlackMessage(t *testing.T) {
	msg := notification.NewSlackMessage("Hello Slack").
		SetChannel("#general").
		SetUsername("Bot").
		SetIcon(":robot:")

	if msg.Text != "Hello Slack" {
		t.Errorf("Expected text 'Hello Slack', got '%s'", msg.Text)
	}
	if msg.Channel != "#general" {
		t.Errorf("Expected channel '#general', got '%s'", msg.Channel)
	}
	if msg.Username != "Bot" {
		t.Errorf("Expected username 'Bot', got '%s'", msg.Username)
	}
	if msg.IconEmoji != ":robot:" {
		t.Errorf("Expected icon ':robot:', got '%s'", msg.IconEmoji)
	}
}

func TestSlackMessage_Attachment(t *testing.T) {
	attachment := notification.SlackAttachment{
		Color:     "#36a64f",
		Title:     "Test Attachment",
		TitleLink: "https://example.com",
		Text:      "Attachment text",
		Fields: []notification.SlackField{
			{Title: "Field1", Value: "Value1", Short: true},
		},
	}

	msg := notification.NewSlackMessage("Test").AddAttachment(attachment)

	if len(msg.Attachments) != 1 {
		t.Errorf("Expected 1 attachment, got %d", len(msg.Attachments))
	}
	if msg.Attachments[0].Title != "Test Attachment" {
		t.Errorf("Expected attachment title 'Test Attachment', got '%s'", msg.Attachments[0].Title)
	}
}

func TestSimpleNotifiable(t *testing.T) {
	user := &notification.SimpleNotifiable{
		ID:    123,
		Email: "user@example.com",
		Phone: "+1234567890",
		Slack: "#user-channel",
	}

	if user.GetID() != 123 {
		t.Errorf("Expected ID 123, got %v", user.GetID())
	}
	if user.RouteNotificationFor("mail") != "user@example.com" {
		t.Errorf("Expected mail route 'user@example.com', got '%s'", user.RouteNotificationFor("mail"))
	}
	if user.RouteNotificationFor("sms") != "+1234567890" {
		t.Errorf("Expected sms route '+1234567890', got '%s'", user.RouteNotificationFor("sms"))
	}
	if user.RouteNotificationFor("slack") != "#user-channel" {
		t.Errorf("Expected slack route '#user-channel', got '%s'", user.RouteNotificationFor("slack"))
	}
	if user.RouteNotificationFor("unknown") != "" {
		t.Errorf("Expected empty route for unknown channel, got '%s'", user.RouteNotificationFor("unknown"))
	}
}

func TestAnonymousNotification(t *testing.T) {
	notif := notification.NewAnonymousNotification("mail", "slack").
		WithMail(func(n notification.Notifiable) *notification.MailMessage {
			return notification.NewMailMessage().
				SetSubject("Welcome").
				SetBody("Hello!")
		}).
		WithSlack(func(n notification.Notifiable) *notification.SlackMessage {
			return notification.NewSlackMessage("Welcome!")
		})

	user := &notification.SimpleNotifiable{ID: 1}

	channels := notif.Via(user)
	if len(channels) != 2 {
		t.Errorf("Expected 2 channels, got %d", len(channels))
	}

	mail := notif.ToMail(user)
	if mail == nil {
		t.Fatal("Expected mail message")
	}
	if mail.Subject != "Welcome" {
		t.Errorf("Expected subject 'Welcome', got '%s'", mail.Subject)
	}

	slack := notif.ToSlack(user)
	if slack == nil {
		t.Fatal("Expected slack message")
	}
	if slack.Text != "Welcome!" {
		t.Errorf("Expected text 'Welcome!', got '%s'", slack.Text)
	}
}

func TestAnonymousNotification_NilHandlers(t *testing.T) {
	notif := notification.NewAnonymousNotification("mail")
	user := &notification.SimpleNotifiable{ID: 1}

	// Should not panic with nil handlers
	if notif.ToMail(user) != nil {
		t.Error("Expected nil mail without handler")
	}
	if notif.ToSMS(user) != nil {
		t.Error("Expected nil sms without handler")
	}
	if notif.ToSlack(user) != nil {
		t.Error("Expected nil slack without handler")
	}
	if notif.ToDatabase(user) != nil {
		t.Error("Expected nil database without handler")
	}
}

func TestAnonymousNotification_Database(t *testing.T) {
	notif := notification.NewAnonymousNotification("database").
		WithDatabase(func(n notification.Notifiable) map[string]interface{} {
			return map[string]interface{}{
				"type":    "welcome",
				"message": "Hello!",
			}
		})

	user := &notification.SimpleNotifiable{ID: 1}
	data := notif.ToDatabase(user)

	if data == nil {
		t.Fatal("Expected database data")
	}
	if data["type"] != "welcome" {
		t.Errorf("Expected type 'welcome', got '%v'", data["type"])
	}
}

func TestManager_RegisterChannel(t *testing.T) {
	manager := notification.New()
	logChannel := notification.NewLogChannel()

	manager.RegisterChannel("log", logChannel)

	channel := manager.Channel("log")
	if channel == nil {
		t.Error("Expected channel to be registered")
	}
}

func TestManager_Channel_NotFound(t *testing.T) {
	manager := notification.New()

	channel := manager.Channel("nonexistent")
	if channel != nil {
		t.Error("Expected nil for nonexistent channel")
	}
}

func TestGlobal_Send(t *testing.T) {
	// Register log channel globally
	logChannel := notification.NewLogChannel()
	notification.RegisterChannel("log", logChannel)

	user := &TestUser{ID: 1, Email: "test@example.com"}
	notif := &TestNotification{Title: "Global Test"}

	ctx := context.Background()
	err := notification.Send(ctx, user, notif)
	if err != nil {
		t.Fatalf("Global Send failed: %v", err)
	}
}

func TestManager_SendNow(t *testing.T) {
	manager := notification.New()
	logChannel := notification.NewLogChannel()
	manager.RegisterChannel("log", logChannel)

	user := &TestUser{ID: 1}
	notif := &TestNotification{Title: "SendNow Test"}

	ctx := context.Background()
	err := manager.SendNow(ctx, user, notif)
	if err != nil {
		t.Fatalf("SendNow failed: %v", err)
	}

	if logChannel.Count() != 1 {
		t.Errorf("Expected 1 message, got %d", logChannel.Count())
	}
}

func TestManager_Send_SkipsUnknownChannel(t *testing.T) {
	manager := notification.New()
	// Don't register any channels

	user := &TestUser{ID: 1}
	notif := &TestNotification{Title: "Test"}

	ctx := context.Background()
	// Should not error even if channel doesn't exist
	err := manager.Send(ctx, user, notif)
	if err != nil {
		t.Fatalf("Send should not fail for unknown channel: %v", err)
	}
}
