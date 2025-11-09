---
layout: post
title: "Payment Service in Spring Boot: Integrating External APIs Without Breaking Your Microservice"
date: 2025-11-09 00:00:00 +0000
categories: Architecture Spring Boot
permalink: /blog/2025/11/09/payment-service-under-the-hood.html
---

Hey there! Day 09 of #30DiasJava is all about moving money safely across microservices. Payment flows are unforgiving: users expect instant confirmation, accounting wants traceability, and finance demands PCI-grade security. Today I’m walking through how I wired a Spring Boot payment service to an external provider (think Stripe, Adyen, MercadoPago) while keeping the system resilient and auditable.

**Disclaimer**: The focus here is architecture and integration patterns. I’m not exposing any credentials or production configs. Treat this as a blueprint you can adapt to your PSP of choice.

## Why I'm Looking at This

**Full disclosure**: I’ve shipped payment integrations where a single network hiccup produced double charges, angry emails, and sleepless nights. This deep dive is my way of documenting the guardrails I wish I’d had the first time.

We’ll cover:

- Domain boundaries between checkout and payment execution
- Secure API client design (timeouts, retries, circuit breaker)
- Idempotency and double-charge prevention
- Webhook handling for asynchronous confirmations
- Audit logging for compliance

## Under the Hood: Architecture Snapshot

```
┌─────────────┐   /checkout   ┌─────────────────┐      ┌──────────────┐
│ Order API   │ ─────────────▶│ Payment Service │─────▶│ PSP (Stripe) │
└─────────────┘               └─────────────────┘      └──────────────┘
        ▲                           │   ▲                         │
        │                           │   │                         │
        │          Webhook          │   │    Publish events       │
        └───────────────────────────┴───┴─────────────────────────┘
                                      ▼
                               ┌──────────────┐
                               │ Event Bus    │ (Kafka/Rabbit)
                               └──────────────┘
```

### Domain Model Highlights

```java
@Entity
@Table(name = "payments", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"order_id", "provider_reference"})
})
public class Payment {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Enumerated(EnumType.STRING)
    private PaymentStatus status; // INITIATED, AUTHORIZED, SETTLED, FAILED

    @Column(name = "provider_reference")
    private String providerReference; // PSP payment intent id

    @Column(name = "currency", length = 3)
    private String currency;

    private BigDecimal amount;
    private Instant createdAt;
    private Instant updatedAt;
}
```

**Design decisions**:

1. **Unique constraint** on `(order_id, provider_reference)` guarantees idempotency when PSP retries callbacks.
2. **Status machine** ensures we never mark a payment settled before the PSP confirms.
3. **Separate table for audit logs** (not shown) retains full event history for compliance.

## External API Client: Secure by Default

```java
@Configuration
@RequiredArgsConstructor
public class PaymentClientConfig {

    @Bean
    public WebClient paymentWebClient(PaymentProperties props) {
        return WebClient.builder()
                .baseUrl(props.getBaseUrl())
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + props.getApiKey())
                .clientConnector(new ReactorClientHttpConnector(
                        HttpClient.create()
                                .secure(spec -> spec.sslContext(SslContextBuilder.forClient()))
                                .responseTimeout(Duration.ofSeconds(10))
                ))
                .filter(logRequest())
                .build();
    }

    private ExchangeFilterFunction logRequest() {
        return ExchangeFilterFunction.ofRequestProcessor(clientRequest -> {
            log.debug("Calling PSP {} {}", clientRequest.method(), clientRequest.url());
            return Mono.just(clientRequest);
        });
    }
}
```

Key points:
- TLS enforced via Reactor Netty SSL config
- 10 second response timeout + retry handled by Resilience4j
- API key injected via Vault/Secrets Manager (never committed)

## Idempotent Charge Execution

```java
@Service
@RequiredArgsConstructor
public class PaymentExecutionService {

    private final PaymentRepository paymentRepository;
    private final PaymentProviderClient providerClient;
    private final CircuitBreaker circuitBreaker;

    @Transactional
    public Payment initiatePayment(UUID orderId, BigDecimal amount, String currency) {
        Payment payment = paymentRepository.save(Payment.builder()
                .orderId(orderId)
                .amount(amount)
                .currency(currency)
                .status(PaymentStatus.INITIATED)
                .createdAt(Instant.now())
                .build());

        ProviderRequest payload = new ProviderRequest(orderId, amount, currency);

        ProviderResponse response = circuitBreaker.executeSupplier(() ->
                providerClient.createPaymentIntent(payload)
        );

        payment.setProviderReference(response.id());
        payment.setStatus(PaymentStatus.AUTHORIZED);
        payment.setUpdatedAt(Instant.now());

        return paymentRepository.save(payment);
    }
}
```

- **Transactional write** ensures the intent is saved before calling the PSP.
- **Circuit breaker** prevents cascading failures when the PSP is down.
- **Provider reference** stored immediately for webhook reconciliation.

## Handling PSP Webhooks

```java
@RestController
@RequestMapping("/webhooks/payments")
@Slf4j
public class PaymentWebhookController {

    private final PaymentService paymentService;
    private final SignatureVerifier signatureVerifier;

    @PostMapping
    public ResponseEntity<Void> handle(@RequestBody String payload,
                                       @RequestHeader("X-Signature") String signature) {
        if (!signatureVerifier.isValid(signature, payload)) {
            log.warn("Invalid PSP signature");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        PaymentEvent event = deserialize(payload);
        paymentService.applyStatusUpdate(event);
        return ResponseEntity.ok().build();
    }
}
```

100% of webhook requests pass through signature verification. No exceptions.

## Outbox Pattern for Reliability

Payments emit domain events so other services (orders, ledger, notifications) stay consistent.

```java
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final PaymentOutboxRepository outboxRepository;

    @Transactional
    public void applyStatusUpdate(PaymentEvent event) {
        Payment payment = paymentRepository.findByProviderReference(event.providerId())
                .orElseThrow(() -> new PaymentNotFoundException(event.providerId()));

        payment.updateStatus(event.newStatus(), event.occurredAt());
        paymentRepository.save(payment);

        outboxRepository.save(OutboxMessage.from(payment));
    }
}
```

A scheduled job publishes outbox rows to Kafka; if the broker is down we retry without losing state.

## Security Checklist

1. **Secrets** in Vault/Secrets Manager (never ENV plain text)
2. **HMAC signatures** for webhooks
3. **Idempotency keys** for client-initiated retries
4. **PCI scope** minimized by delegating card handling to PSP
5. **Audit log** (who/when changed payment status)

## Testing Strategy

- Contract tests with WireMock simulating PSP responses
- Testcontainers + LocalStack for webhook + S3 receipt storage
- Unit tests for state transitions (INITIATED → AUTHORIZED → SETTLED)
- Chaos test: disable PSP endpoint to validate circuit breaker fallback

## Real-World Impact

I’ve seen payment teams lose thousands to double charges because callbacks weren’t idempotent. With this setup:

- Duplicate webhook? Unique constraint blocks it.
- PSP offline? Circuit breaker opens and orders stay pending.
- Finance audit? Outbox + event log reconstructs the timeline instantly.

## What Can We Learn From This?

| Decision | Result |
|----------|--------|
| Save payment intent **before** PSP call | Enables retries without losing state |
| Circuit breaker around PSP | Protects checkout when provider is unstable |
| Webhook signature + idempotency | Prevents fraud and double charges |
| Outbox pattern | Guarantees downstream consistency |
| Audit + metrics | Gives finance and SREs observability |

## Final Thoughts

Integrating external payment APIs isn’t just wiring REST calls. It’s balancing user experience, resilience, and compliance. The blueprint above has saved me from war rooms and refund marathons—hope it does the same for you.

---

**Full project:** [30DiasJava-Day09-Payment](https://github.com/adelmonsouza/30DiasJava-Day09-Payment)

**Next article:** Reporting Service Under the Hood: From Aggregates to Executive Dashboards (Day 10)

---

**#30DiasJava | #SpringBoot | #Payments | #Resilience | #Microservices**
