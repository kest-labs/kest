package events_test

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/kest-labs/kest/api/internal/infra/events"
)

// ============================================
// 场景 1: 用户注册后发送欢迎邮件 + 初始化积分
// ============================================

// UserCreatedEvent 用户创建事件
type UserCreatedEvent struct {
	events.BaseEvent
	UserID   uint
	Username string
	Email    string
}

func (e UserCreatedEvent) EventName() string {
	return "user.created"
}

// EmailService 邮件服务
type EmailService struct{}

func (s *EmailService) SendWelcomeEmail(ctx context.Context, email, username string) error {
	fmt.Printf("📧 Sending welcome email to %s (%s)\n", username, email)
	return nil
}

// PointsService 积分服务
type PointsService struct{}

func (s *PointsService) InitializePoints(ctx context.Context, userID uint) error {
	fmt.Printf("🎁 Initializing 100 points for user %d\n", userID)
	return nil
}

func ExampleEventBus_userRegistration() {
	bus := events.NewEventBus()
	emailSvc := &EmailService{}
	pointsSvc := &PointsService{}

	// 订阅用户创建事件 - 发送欢迎邮件
	bus.Subscribe("user.created", func(ctx context.Context, event events.Event) error {
		e := event.(UserCreatedEvent)
		return emailSvc.SendWelcomeEmail(ctx, e.Email, e.Username)
	})

	// 订阅用户创建事件 - 初始化积分
	bus.Subscribe("user.created", func(ctx context.Context, event events.Event) error {
		e := event.(UserCreatedEvent)
		return pointsSvc.InitializePoints(ctx, e.UserID)
	})

	// 模拟用户注册
	event := UserCreatedEvent{
		BaseEvent: events.NewBaseEventWithSource("user-service"),
		UserID:    1,
		Username:  "john",
		Email:     "john@example.com",
	}

	_ = bus.Publish(context.Background(), event)

	// Output:
	// 📧 Sending welcome email to john (john@example.com)
	// 🎁 Initializing 100 points for user 1
}

// ============================================
// 场景 2: 订单状态变更 - 通配符订阅
// ============================================

// OrderEvent 订单事件基类
type OrderEvent struct {
	events.BaseEvent
	OrderID string
	Status  string
}

func (e OrderEvent) EventName() string {
	return "order." + e.Status
}

func ExampleEventBus_wildcardSubscription() {
	bus := events.NewEventBus()

	// 订阅所有订单事件 - 用于日志记录
	bus.Subscribe("order.*", func(ctx context.Context, event events.Event) error {
		e := event.(OrderEvent)
		fmt.Printf("📝 Order %s status changed to: %s\n", e.OrderID, e.Status)
		return nil
	})

	// 只订阅订单完成事件 - 发送通知
	bus.Subscribe("order.completed", func(ctx context.Context, event events.Event) error {
		e := event.(OrderEvent)
		fmt.Printf("🎉 Order %s completed! Sending notification...\n", e.OrderID)
		return nil
	})

	// 发布不同状态的订单事件
	ctx := context.Background()
	_ = bus.Publish(ctx, OrderEvent{BaseEvent: events.NewBaseEvent(), OrderID: "ORD-001", Status: "created"})
	_ = bus.Publish(ctx, OrderEvent{BaseEvent: events.NewBaseEvent(), OrderID: "ORD-001", Status: "paid"})
	_ = bus.Publish(ctx, OrderEvent{BaseEvent: events.NewBaseEvent(), OrderID: "ORD-001", Status: "completed"})

	// Output:
	// 📝 Order ORD-001 status changed to: created
	// 📝 Order ORD-001 status changed to: paid
	// 📝 Order ORD-001 status changed to: completed
	// 🎉 Order ORD-001 completed! Sending notification...
}

// ============================================
// 场景 3: 优先级处理 - 库存检查优先于发货
// ============================================

func ExampleEventBus_priority() {
	bus := events.NewEventBus()

	// 低优先级: 发货处理
	bus.Subscribe("order.paid", func(ctx context.Context, event events.Event) error {
		fmt.Println("3️⃣ Processing shipment...")
		return nil
	}, events.WithPriority(10))

	// 高优先级: 库存检查 (必须先执行)
	bus.Subscribe("order.paid", func(ctx context.Context, event events.Event) error {
		fmt.Println("1️⃣ Checking inventory...")
		return nil
	}, events.WithPriority(100))

	// 中优先级: 扣减库存
	bus.Subscribe("order.paid", func(ctx context.Context, event events.Event) error {
		fmt.Println("2️⃣ Deducting inventory...")
		return nil
	}, events.WithPriority(50))

	_ = bus.Publish(context.Background(), OrderEvent{
		BaseEvent: events.NewBaseEvent(),
		OrderID:   "ORD-002",
		Status:    "paid",
	})

	// Output:
	// 1️⃣ Checking inventory...
	// 2️⃣ Deducting inventory...
	// 3️⃣ Processing shipment...
}

// ============================================
// 场景 4: 异步处理 - 不阻塞主流程
// ============================================

func ExampleEventBus_async() {
	bus := events.NewEventBus()
	var wg sync.WaitGroup
	wg.Add(1)

	// 异步发送短信 (不阻塞主流程)
	bus.Subscribe("user.created", func(ctx context.Context, event events.Event) error {
		defer wg.Done()
		time.Sleep(10 * time.Millisecond) // 模拟耗时操作
		fmt.Println("📱 SMS sent (async)")
		return nil
	}, events.WithAsync())

	// 同步更新统计
	bus.Subscribe("user.created", func(ctx context.Context, event events.Event) error {
		fmt.Println("📊 Stats updated (sync)")
		return nil
	})

	event := UserCreatedEvent{
		BaseEvent: events.NewBaseEvent(),
		UserID:    2,
		Username:  "jane",
		Email:     "jane@example.com",
	}

	_ = bus.Publish(context.Background(), event)
	fmt.Println("✅ Publish returned immediately")

	wg.Wait() // 等待异步完成

	// Output:
	// 📊 Stats updated (sync)
	// ✅ Publish returned immediately
	// 📱 SMS sent (async)
}

// ============================================
// 场景 5: 中间件 - 日志 + 追踪
// ============================================

func ExampleEventBus_middleware() {
	bus := events.NewEventBus()

	// 日志中间件
	bus.Use(func(next events.EventHandler) events.EventHandler {
		return func(ctx context.Context, event events.Event) error {
			fmt.Printf("🔍 [LOG] Event: %s, ID: %s\n", event.EventName(), event.Metadata().ID[:8])
			return next(ctx, event)
		}
	})

	// 耗时追踪中间件
	bus.Use(func(next events.EventHandler) events.EventHandler {
		return func(ctx context.Context, event events.Event) error {
			start := time.Now()
			err := next(ctx, event)
			fmt.Printf("⏱️ [TRACE] %s took %v\n", event.EventName(), time.Since(start))
			return err
		}
	})

	bus.Subscribe("payment.received", func(ctx context.Context, event events.Event) error {
		fmt.Println("💰 Processing payment...")
		return nil
	})

	_ = bus.Publish(context.Background(), OrderEvent{
		BaseEvent: events.NewBaseEvent(),
		OrderID:   "ORD-003",
		Status:    "received",
	})

	// Output shows middleware wrapping the handler
}

// ============================================
// 场景 6: 事件关联追踪 (Correlation)
// ============================================

func ExampleEventBus_correlation() {
	bus := events.NewEventBus()

	// 订单创建触发支付事件
	bus.Subscribe("order.created", func(ctx context.Context, event events.Event) error {
		orderEvent := event.(OrderEvent)
		meta := event.Metadata()

		// 创建关联的支付事件
		paymentEvent := OrderEvent{
			BaseEvent: events.NewBaseEventWithCorrelation(
				meta.CorrelationID, // 保持相同的 correlation ID
				meta.ID,            // 当前事件 ID 作为 causation ID
				"payment-service",
			),
			OrderID: orderEvent.OrderID,
			Status:  "payment_initiated",
		}

		fmt.Printf("📦 Order %s created (correlation: %s)\n", orderEvent.OrderID, meta.CorrelationID[:8])
		return bus.Publish(ctx, paymentEvent)
	})

	bus.Subscribe("order.payment_initiated", func(ctx context.Context, event events.Event) error {
		meta := event.Metadata()
		fmt.Printf("💳 Payment initiated (correlation: %s, caused by: %s)\n",
			meta.CorrelationID[:8], meta.CausationID[:8])
		return nil
	})

	// 创建带 correlation ID 的初始事件
	initialEvent := OrderEvent{
		BaseEvent: events.NewBaseEventWithCorrelation("corr-12345678", "", "order-service"),
		OrderID:   "ORD-004",
		Status:    "created",
	}

	_ = bus.Publish(context.Background(), initialEvent)

	// Output shows correlation tracking across events
}

// ============================================
// 场景 7: 取消订阅
// ============================================

func ExampleSubscription_unsubscribe() {
	bus := events.NewEventBus()

	callCount := 0
	sub := bus.Subscribe("order.test", func(ctx context.Context, event events.Event) error {
		callCount++
		fmt.Printf("Handler called %d time(s)\n", callCount)
		return nil
	})

	// 第一次发布
	_ = bus.Publish(context.Background(), OrderEvent{BaseEvent: events.NewBaseEvent(), OrderID: "1", Status: "test"})

	// 取消订阅
	sub.Unsubscribe()
	fmt.Println("Unsubscribed")

	// 第二次发布 - handler 不会被调用
	_ = bus.Publish(context.Background(), OrderEvent{BaseEvent: events.NewBaseEvent(), OrderID: "2", Status: "test"})
	fmt.Printf("Final call count: %d\n", callCount)

	// Output:
	// Handler called 1 time(s)
	// Unsubscribed
	// Final call count: 1
}
