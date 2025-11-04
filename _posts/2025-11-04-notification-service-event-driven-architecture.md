---
layout: post
title: "Notification Service: Event-Driven Architecture, WebSockets, and Real-Time Communication"
date: 2025-11-04
author: "Adelmon Souza"
categories: ["Architecture", "Spring Boot", "Real-Time"]
tags: ["notification-service", "event-driven", "websockets", "spring-boot", "java", "microservices", "real-time"]
excerpt: "Learn how to build a notification service microservice using Spring Boot, exploring event-driven architecture patterns, WebSockets for real-time communication, message queues, and resilience strategies used in production systems."
---

**Day 4-5 of #30DiasJava** – Building production-ready Java microservices with real-world patterns.

Hey there! Today we're diving into **Notification Services** – the backbone of modern real-time applications. From push notifications on your phone to live updates in chat applications, notification systems power the instant feedback users expect.

**Disclaimer**: This article explores event-driven architecture patterns and real-time communication strategies. We'll build a notification service that demonstrates production-ready patterns used by companies like Slack, Discord, and WhatsApp.

## Why Notification Services Matter

Modern applications are expected to be **real-time**. Users want instant feedback:
- Push notifications when someone comments on their post
- Live updates when their order status changes
- Real-time chat messages
- Instant alerts for important events

Building a notification service that scales requires understanding:
1. **Event-Driven Architecture** – Decoupling producers and consumers
2. **Real-Time Communication** – WebSockets vs Server-Sent Events
3. **Message Queues** – Reliable message delivery
4. **Resilience Patterns** – Handling failures gracefully

## The Architecture: Event-Driven Pattern

Event-driven architecture decouples components by having them communicate through events. When something happens (an event), interested parties are notified.

### Core Components

```
┌─────────────┐      Events      ┌──────────────────┐
│   Service   │ ────────────────> │  Event Publisher │
│  (Producer) │                   └──────────────────┘
└─────────────┘                            │
                                           │
                                           ▼
                                  ┌─────────────────┐
                                  │  Message Queue  │
                                  │  (RabbitMQ/     │
                                  │   Kafka)        │
                                  └─────────────────┘
                                           │
                                           ▼
                                  ┌──────────────────┐
                                  │ Notification     │
                                  │ Service          │
                                  │ (Consumer)       │
                                  └──────────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    ▼                      ▼                      ▼
            ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
            │  WebSocket   │      │   Push       │      │   Email      │
            │   Server     │      │ Notification │      │   Service    │
            └──────────────┘      └──────────────┘      └──────────────┘
```

### Domain Model

Our notification service uses three core entities:

```java
@Entity
@Table(name = "notifications", indexes = {
    @Index(name = "idx_notification_user_status", 
           columnList = "user_id,status"),
    @Index(name = "idx_notification_created", 
           columnList = "created_at DESC")
})
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    
    @Enumerated(EnumType.STRING)
    private NotificationType type; // PUSH, EMAIL, SMS, IN_APP
    
    @Enumerated(EnumType.STRING)
    private NotificationStatus status; // PENDING, SENT, FAILED, READ
    
    @Column(nullable = false)
    private String title;
    
    @Column(columnDefinition = "TEXT")
    private String message;
    
    @Column(columnDefinition = "JSONB")
    private Map<String, Object> metadata; // Custom data
    
    private LocalDateTime createdAt;
    private LocalDateTime sentAt;
    private LocalDateTime readAt;
}
```

**Key Design Decisions**:

1. **Composite Index**: `(user_id, status)` enables fast queries for unread notifications
2. **JSONB Metadata**: Flexible storage for notification-specific data (links, images, etc.)
3. **Status Tracking**: Full audit trail of notification lifecycle
4. **Type Enumeration**: Different delivery channels require different handling

## Event-Driven Implementation

### Publishing Events

When something important happens, publish an event:

```java
@Service
@RequiredArgsConstructor
public class NotificationEventPublisher {
    
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;
    
    public void publishNotificationEvent(NotificationEvent event) {
        try {
            String message = objectMapper.writeValueAsString(event);
            rabbitTemplate.convertAndSend(
                "notification.exchange",
                "notification.created",
                message
            );
            log.info("Published notification event: {}", event.getEventId());
        } catch (Exception e) {
            log.error("Failed to publish notification event", e);
            // Fallback: Save to database for retry
            saveEventForRetry(event);
        }
    }
}

@Data
@Builder
public class NotificationEvent {
    private UUID eventId;
    private UUID userId;
    private NotificationType type;
    private String title;
    private String message;
    private Map<String, Object> metadata;
    private LocalDateTime timestamp;
}
```

### Consuming Events

The notification service consumes events and processes them:

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationEventListener {
    
    private final NotificationService notificationService;
    
    @RabbitListener(queues = "notification.queue")
    public void handleNotificationEvent(String message) {
        try {
            NotificationEvent event = objectMapper.readValue(
                message, 
                NotificationEvent.class
            );
            
            notificationService.createAndSendNotification(event);
            
        } catch (Exception e) {
            log.error("Failed to process notification event", e);
            // Dead letter queue handling
            throw new AmqpRejectAndDontRequeueException(e);
        }
    }
}
```

## Real-Time Communication: WebSockets

For in-app notifications, WebSockets provide bidirectional communication.

### WebSocket Configuration

```java
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
    
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(new NotificationWebSocketHandler(), "/ws/notifications")
                .setAllowedOrigins("*") // Configure properly for production
                .withSockJS(); // Fallback for browsers without WebSocket support
    }
}

@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationWebSocketHandler extends TextWebSocketHandler {
    
    private final Map<UUID, Set<WebSocketSession>> userSessions = new ConcurrentHashMap<>();
    
    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        UUID userId = extractUserId(session);
        userSessions.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet())
                    .add(session);
        log.info("WebSocket connected: user={}, session={}", userId, session.getId());
    }
    
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        UUID userId = extractUserId(session);
        Set<WebSocketSession> sessions = userSessions.get(userId);
        if (sessions != null) {
            sessions.remove(session);
            if (sessions.isEmpty()) {
                userSessions.remove(userId);
            }
        }
        log.info("WebSocket disconnected: user={}, session={}", userId, session.getId());
    }
    
    public void sendNotification(UUID userId, Notification notification) {
        Set<WebSocketSession> sessions = userSessions.get(userId);
        if (sessions != null && !sessions.isEmpty()) {
            String message = toJson(notification);
            sessions.forEach(session -> {
                try {
                    if (session.isOpen()) {
                        session.sendMessage(new TextMessage(message));
                    }
                } catch (IOException e) {
                    log.error("Failed to send WebSocket message", e);
                }
            });
        }
    }
    
    private UUID extractUserId(WebSocketSession session) {
        // Extract from JWT token or session attributes
        Principal principal = session.getPrincipal();
        // Implementation depends on your auth strategy
        return UUID.fromString(principal.getName());
    }
}
```

### Client-Side Connection

```javascript
// React/TypeScript example
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

class NotificationService {
  private client: Client;
  
  connect(userId: string, onNotification: (notification: Notification) => void) {
    this.client = new Client({
      webSocketFactory: () => new SockJS('/ws/notifications'),
      connectHeaders: {
        Authorization: `Bearer ${getAuthToken()}`
      },
      onConnect: () => {
        this.client.subscribe(`/user/${userId}/notifications`, (message) => {
          const notification = JSON.parse(message.body);
          onNotification(notification);
        });
      },
      onStompError: (error) => {
        console.error('WebSocket error:', error);
      }
    });
    
    this.client.activate();
  }
  
  disconnect() {
    if (this.client) {
      this.client.deactivate();
    }
  }
}
```

## Alternative: Server-Sent Events (SSE)

For one-way communication (server to client), SSE is simpler:

```java
@GetMapping(value = "/notifications/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<ServerSentEvent<Notification>> streamNotifications(
        @AuthenticationPrincipal User user) {
    
    return notificationService.findUnreadNotifications(user.getId())
        .map(notification -> ServerSentEvent.<Notification>builder()
            .id(notification.getId().toString())
            .event("notification")
            .data(notification)
            .build())
        .delayElements(Duration.ofSeconds(1))
        .doOnCancel(() -> log.info("SSE stream cancelled for user: {}", user.getId()));
}
```

**When to Use Each**:

| Approach | Use Case | Pros | Cons |
|----------|----------|------|------|
| **WebSocket** | Bidirectional, chat, gaming | Full duplex, low latency | More complex, stateful |
| **SSE** | One-way updates, feeds | Simple, auto-reconnect | One-way only, HTTP/2 required |
| **Polling** | Simple scenarios | Very simple | Inefficient, not real-time |

## Message Queue Integration

### RabbitMQ Configuration

```java
@Configuration
@EnableRabbit
public class RabbitMQConfig {
    
    @Bean
    public TopicExchange notificationExchange() {
        return new TopicExchange("notification.exchange");
    }
    
    @Bean
    public Queue notificationQueue() {
        return QueueBuilder.durable("notification.queue")
                .withArgument("x-dead-letter-exchange", "notification.dlx")
                .withArgument("x-dead-letter-routing-key", "notification.failed")
                .build();
    }
    
    @Bean
    public Binding notificationBinding() {
        return BindingBuilder
                .bind(notificationQueue())
                .to(notificationExchange())
                .with("notification.created");
    }
    
    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(new Jackson2JsonMessageConverter());
        return template;
    }
}
```

### Retry Strategy

```java
@RabbitListener(queues = "notification.queue")
public void handleNotificationEvent(NotificationEvent event) {
    int maxRetries = 3;
    int attempt = 0;
    
    while (attempt < maxRetries) {
        try {
            notificationService.sendNotification(event);
            return; // Success
        } catch (Exception e) {
            attempt++;
            if (attempt >= maxRetries) {
                // Send to dead letter queue
                sendToDeadLetterQueue(event, e);
            } else {
                // Exponential backoff
                Thread.sleep(1000 * (long) Math.pow(2, attempt));
            }
        }
    }
}
```

## Resilience Patterns

### Circuit Breaker

When external services fail, prevent cascading failures:

```java
@Service
@RequiredArgsConstructor
public class PushNotificationService {
    
    private final Resilience4jCircuitBreaker circuitBreaker;
    
    @CircuitBreaker(name = "push-service", fallbackMethod = "fallbackSendPush")
    public void sendPushNotification(UUID userId, String title, String message) {
        // Call external push service (FCM, APNS, etc.)
        pushServiceClient.send(userId, title, message);
    }
    
    public void fallbackSendPush(UUID userId, String title, String message, Exception e) {
        log.warn("Push service unavailable, queuing for retry", e);
        // Save to database for later retry
        notificationRepository.save(Notification.builder()
            .userId(userId)
            .type(NotificationType.PUSH)
            .status(NotificationStatus.PENDING)
            .title(title)
            .message(message)
            .build());
    }
}
```

### Rate Limiting

Prevent notification spam:

```java
@Service
@RequiredArgsConstructor
public class NotificationRateLimiter {
    
    private final RedisTemplate<String, String> redisTemplate;
    
    public boolean isAllowed(UUID userId, NotificationType type) {
        String key = String.format("notification:rate:%s:%s", userId, type);
        String count = redisTemplate.opsForValue().get(key);
        
        int currentCount = count != null ? Integer.parseInt(count) : 0;
        int maxNotifications = getMaxNotifications(type); // e.g., 10 per hour
        
        if (currentCount >= maxNotifications) {
            return false;
        }
        
        redisTemplate.opsForValue().increment(key);
        redisTemplate.expire(key, Duration.ofHours(1));
        
        return true;
    }
}
```

## Testing Real-Time Features

### WebSocket Testing

```java
@SpringBootTest
@AutoConfigureMockMvc
class NotificationWebSocketTest {
    
    @Autowired
    private WebSocketHandler webSocketHandler;
    
    @Test
    void testWebSocketConnection() throws Exception {
        MockWebSocketSession session = new MockWebSocketSession();
        webSocketHandler.afterConnectionEstablished(session);
        
        Notification notification = createTestNotification();
        webSocketHandler.sendNotification(userId, notification);
        
        assertThat(session.getSentMessages()).hasSize(1);
        assertThat(session.getSentMessages().get(0).getPayload())
            .contains(notification.getTitle());
    }
}
```

### Event-Driven Testing

```java
@SpringBootTest
@RabbitListenerTest
class NotificationEventTest {
    
    @Autowired
    private RabbitTemplate rabbitTemplate;
    
    @Autowired
    private NotificationRepository notificationRepository;
    
    @Test
    void testNotificationEventProcessing() {
        NotificationEvent event = NotificationEvent.builder()
            .userId(testUserId)
            .type(NotificationType.PUSH)
            .title("Test Notification")
            .message("Test message")
            .build();
        
        rabbitTemplate.convertAndSend("notification.exchange", 
                                     "notification.created", 
                                     event);
        
        // Wait for async processing
        await().atMost(5, SECONDS).until(() -> 
            notificationRepository.findByUserId(testUserId).size() > 0
        );
        
        List<Notification> notifications = 
            notificationRepository.findByUserId(testUserId);
        
        assertThat(notifications).hasSize(1);
        assertThat(notifications.get(0).getStatus())
            .isEqualTo(NotificationStatus.SENT);
    }
}
```

## Production Considerations

### Scalability

**Horizontal Scaling**:
- Use sticky sessions for WebSocket connections
- Distribute connections across multiple instances
- Use Redis pub/sub for cross-instance communication

```java
@Configuration
public class RedisPubSubConfig {
    
    @Bean
    public RedisMessageListenerContainer redisContainer(
            RedisConnectionFactory connectionFactory) {
        RedisMessageListenerContainer container = 
            new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        return container;
    }
    
    @EventListener
    public void handleNotificationEvent(NotificationEvent event) {
        // Publish to Redis so all instances can handle it
        redisTemplate.convertAndSend("notification:channel", event);
    }
}
```

### Monitoring

Key metrics to track:
- WebSocket connection count
- Message queue depth
- Notification delivery rate
- Failure rate by type
- Average delivery latency

```java
@Component
@RequiredArgsConstructor
public class NotificationMetrics {
    
    private final MeterRegistry meterRegistry;
    
    public void recordNotificationSent(NotificationType type) {
        meterRegistry.counter("notifications.sent", "type", type.name())
                    .increment();
    }
    
    public void recordNotificationFailed(NotificationType type) {
        meterRegistry.counter("notifications.failed", "type", type.name())
                    .increment();
    }
    
    public void recordDeliveryLatency(Duration duration, NotificationType type) {
        meterRegistry.timer("notifications.delivery.latency", "type", type.name())
                    .record(duration);
    }
}
```

## Real-World Impact

I've seen production notification systems where:

* WebSocket connections were lost after 30 seconds
* Notifications were delivered multiple times
* The system couldn't handle more than 100 concurrent connections
* Failed notifications were lost forever

With proper implementation:

* Stable WebSocket connections with auto-reconnect
* Exactly-once delivery guarantees
* Handles 10,000+ concurrent connections
* Failed notifications retried automatically

The difference is **critical** for user experience.

## Key Takeaways

1. **Event-driven architecture decouples services** – Producers don't need to know about consumers
2. **WebSockets enable real-time bidirectional communication** – But require careful connection management
3. **Message queues ensure reliable delivery** – Even when services are temporarily unavailable
4. **Circuit breakers prevent cascading failures** – Protect against external service outages
5. **Rate limiting prevents spam** – Critical for user experience
6. **Monitoring is essential** – Track connection health, delivery rates, and failures
7. **Testing real-time features requires special approaches** – Mock WebSocket sessions and async event processing

Building notification services isn't just about sending messages – it's about **creating reliable, scalable, real-time communication** that enhances user experience without overwhelming them.

---

**Full project:** [Notification Service on GitHub](https://github.com/adelmonsouza/30DiasJava-Day04-NotificationService)

**Previous article:** [Day 03: Recommendation Engine](https://enouveau.io/blog/2025/11/03/recommendation-engine-collaborative-filtering.html)

**Next article:** Payment Service: Distributed Transactions and Saga Pattern (Day 6-7)

---

| **#30DiasJava | #SpringBoot | #EventDriven | #WebSockets | #Microservices** |
|---------------|-------------|--------------|-------------|-----------------|

---

## Comments

Want to share your thoughts or ask a question? Comments are powered by GitHub Discussions. [Join the discussion →](https://github.com/adelmonsouza/30DiasJava-Day04-NotificationService/discussions)

Did you find this article useful?

👍 0 Useful ❤️ 0 Loved it 🎓 0 Learned ✅ 0 Applied

