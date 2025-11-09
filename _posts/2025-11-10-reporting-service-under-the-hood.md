---
layout: post
title: "Reporting Service in Spring Boot: Turning Raw Events into Executive Dashboards"
date: 2025-11-10 00:00:00 +0000
categories: Architecture Spring Boot
permalink: /blog/2025/11/10/reporting-service-under-the-hood.html
---

Day 10 of #30DiasJava and it’s time to talk about reporting. Everyone loves dashboards, but pulling real metrics out of transactional data without setting production on fire is tricky. Today’s build condenses my lessons from shipping analytics services: we’ll aggregate events, generate PDFs/CSVs, and expose insights via REST.

**Disclaimer**: No real customer data is exposed. All datasets are synthetic, focusing on architecture and patterns you can adapt internally.

## Why I'm Looking at This

Product teams want churn, finance wants MRR, customer success wants NPS—in one place, updated hourly. I’ve hacked too many spreadsheets to ignore the problem. This reporting service consolidates:

- Data ingestion from event streams and OLTP read replicas
- Aggregation with Spring Batch + SQL window functions
- Caching layers to avoid hammering the database
- PDF/CSV exports with templated visuals
- Role-based access to sensitive metrics

## System Overview

```
┌──────────────┐    Kafka/SQS    ┌──────────────────────┐
│ Event Source │ ───────────────▶│ Reporting Ingestion  │
└──────────────┘                 └─────────┬────────────┘
                                           │
                               ┌───────────▼───────────┐
                               │ Reporting Warehouse   │ (PostgreSQL + JSONB)
                               └───────────┬───────────┘
                                           │
                     ┌─────────────────────▼─────────────────────┐
                     │ Spring Boot Reporting Service             │
                     │ - REST API (/reports)                     │
                     │ - Batch Jobs (hourly)                     │
                     │ - Export Engine (PDF/CSV)                 │
                     └──────────────┬──────────────┬─────────────┘
                                    │              │
                             ┌──────▼───────┐ ┌────▼─────┐
                             │ React Admin │ │ S3/Email │
                             └─────────────┘ └───────────┘
```

## Schema & Aggregation Strategy

```sql
CREATE TABLE revenue_daily (
    id BIGSERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    product_code VARCHAR(50) NOT NULL,
    invoices_count INT NOT NULL,
    gross_amount NUMERIC(12,2) NOT NULL,
    discounts NUMERIC(12,2) NOT NULL,
    net_amount NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (snapshot_date, product_code)
);
```

- Separate tables per domain (revenue, churn, funnel, support tickets)
- Each row is a **daily snapshot**; we never recompute large ranges on the fly

## Batch Job for Snapshots

```java
@Configuration
@RequiredArgsConstructor
public class RevenueSnapshotJobConfig {

    private final JobBuilderFactory jobBuilderFactory;
    private final StepBuilderFactory stepBuilderFactory;
    private final RevenueSnapshotTasklet tasklet;

    @Bean
    public Job revenueSnapshotJob() {
        return jobBuilderFactory.get("revenueSnapshotJob")
                .start(snapshotStep())
                .build();
    }

    @Bean
    public Step snapshotStep() {
        return stepBuilderFactory.get("snapshotStep")
                .tasklet(tasklet)
                .build();
    }
}
```

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class RevenueSnapshotTasklet implements Tasklet {

    private final RevenueSnapshotRepository repository;
    private final RevenueSourceService revenueSourceService;

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        LocalDate snapshotDate = LocalDate.now().minusDays(1);
        List<RevenueSnapshot> snapshots = revenueSourceService.fetchSnapshot(snapshotDate);
        repository.upsert(snapshotDate, snapshots);
        log.info("Stored {} revenue snapshots for {}", snapshots.size(), snapshotDate);
        return RepeatStatus.FINISHED;
    }
}
```

- Job runs hourly (Quartz) but only recalculates missing rows
- `upsert` uses PostgreSQL `ON CONFLICT` to keep the latest numbers atomically

## REST API with Projection + Caching

```java
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class RevenueReportController {

    private final RevenueReportService revenueReportService;

    @GetMapping("/revenue/daily")
    public List<RevenueDailyView> getDailyRevenue(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end) {
        return revenueReportService.getDailyRevenue(start, end);
    }
}
```

```java
@Service
@RequiredArgsConstructor
public class RevenueReportService {

    private final RevenueDailyRepository repository;
    private final CacheManager cacheManager;

    @Cacheable(cacheNames = "revenue-daily", key = "#start.toString() + ':' + #end.toString()")
    public List<RevenueDailyView> getDailyRevenue(LocalDate start, LocalDate end) {
        return repository.findByRange(start, end);
    }
}
```

- JPA projection returns aggregated DTO only (no entity graph explosion)
- Spring Cache backed by Redis keeps popular ranges hot

## Export Engine (PDF + CSV)

```java
@Service
@RequiredArgsConstructor
public class ReportExportService {

    private final TemplateEngine templateEngine;
    private final PdfRenderer pdfRenderer;
    private final CsvWriter csvWriter;

    public byte[] exportPdf(ReportRequest request) {
        Map<String, Object> model = loadReportModel(request);
        String html = templateEngine.process("reports/revenue", model);
        return pdfRenderer.render(html);
    }

    public byte[] exportCsv(ReportRequest request) {
        List<RevenueDailyView> rows = revenueReportService.getDailyRevenue(
                request.startDate(), request.endDate());
        return csvWriter.write(rows, RevenueDailyView.class);
    }
}
```

- PDFs rendered with Flying Saucer (OpenPDF) using Thymeleaf templates
- CSVs via Jackson `CsvMapper`
- Files stored in S3 and shared via pre-signed URLs / email

## Role-Based Access Control

```java
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf().disable()
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET, "/api/reports/revenue/**")
                    .hasAnyRole("FINANCE","EXECUTIVE")
                .requestMatchers(HttpMethod.POST, "/api/reports/export/**")
                    .hasRole("FINANCE")
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth -> oauth.jwt())
            .build();
    }
}
```

- OAuth2 Resource Server for authentication
- Finance-only access to exports, read-only access for leadership

## Metrics & Monitoring

```java
@Component
@RequiredArgsConstructor
public class ReportingMetrics {

    private final MeterRegistry meterRegistry;

    public void recordBatchDuration(String domain, Duration duration) {
        meterRegistry.timer("reporting.batch.duration", "domain", domain)
                .record(duration);
    }

    public void recordExport(String format) {
        meterRegistry.counter("reporting.export.count", "format", format)
                .increment();
    }
}
```

Dashboards track:
- Batch duration / failures
- Export counts by format
- Cache hit rate (Redis)
- API latency by report type

## What Can We Learn From This?

| Decision | Result |
|----------|--------|
| Snapshot tables with `ON CONFLICT` | Safe re-runs, no duplicate rows |
| Separate ingestion + serving layers | Keeps OLTP load minimal |
| Redis caching for popular ranges | Millisecond response for dashboards |
| PDF/CSV export service | Self-serve reports without manual effort |
| Role-based access | Finance gets data, others see only what’s allowed |

## Final Thoughts

Reporting is as much about discipline as it is about code. By snapshotting data, caching smartly, and automating exports, we transform raw events into insights leadership can act on. Most importantly, the pipeline is auditable—no more mystery spreadsheets.

---

**Full project:** [30DiasJava-Day10-Reporting](https://github.com/adelmonsouza/30DiasJava-Day10-Reporting)

**Next article:** Coming soon — Day 11 explores feature flags and progressive delivery.

---

**#30DiasJava | #SpringBoot | #Analytics | #Reporting | #DataEngineering**
