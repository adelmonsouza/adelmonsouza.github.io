---
layout: post
title: "Efficient Pagination in Spring Boot: How Design Decisions Prevent OutOfMemoryError"
date: 2025-11-02 00:00:00 +0000
categories: Performance Spring Boot
permalink: /blog/2025/11/02/pagination-under-the-hood.html
---

Hey there! So I've been diving into performance optimization lately, and it's been quite the journey. I wanted to share some thoughts on how the design decisions we make can have these ripple effects throughout our applications – especially when it comes to memory management and scalability.

**Disclaimer**: This article is not a critique of Spring Boot or JPA – both are excellent tools. Rather, this is an analysis of how architectural decisions influence performance over time, using pagination as a case study. My goal is to examine the relationship between design principles and performance outcomes, and extract lessons that apply to any architecture we might create or adopt.

## Why I'm Looking at This

**Full disclosure**: I haven't always used pagination in my Spring Boot projects, and honestly, I've made the mistake of using `findAll()` on large tables more times than I'd like to admit. But that's not because pagination is complex – it's just that the benefits aren't always obvious when you're starting out.

That said, pagination makes for a fascinating case study. After building several production Spring Boot applications, I've learned that **performance isn't something that just happens automatically. You really have to work for it,** _right?_ And architectural choices can either make that easier or… well, much harder.

So I thought it would be interesting to look at what happens when you skip pagination, see where developers struggle with `OutOfMemoryError`, and connect those struggles back to the core architectural decisions. Not to criticize an approach, but to learn from it – because these lessons apply to any architecture we might design or adopt.

During a performance audit on one of my projects, I discovered that a single `repository.findAll()` call on a table with 1 million records consumed 500 MB of memory. When scaled to 1000 concurrent users, that's 500 GB of RAM just for one endpoint. That's… not great.

It's worth noting that this isn't just theoretical – many production Spring Boot applications have crashed with `OutOfMemoryError` because they simply loaded too much data into memory at once.

But why is that happening? Let's break down how skipping pagination translates to performance challenges:

### The Foundation: Loading Everything into Memory

First, let's understand what happens when you call `findAll()`. In Spring Boot, it's tempting to do this:

```java
@RestController
@RequestMapping("/api/content")
public class ContentController {
    
    @Autowired
    private ContentRepository contentRepository;
    
    @GetMapping
    public List<Content> getAllContent() {
        return contentRepository.findAll();  // ← Loads EVERYTHING!
    }
}
```

This code works. It's simple. It's clean. But here's the problem: **when you call `findAll()`, Hibernate loads every single record into memory**.

### The Critical Rule: Everything Gets Loaded

When you use `findAll()`, the framework:

1. Executes `SELECT * FROM content` (no LIMIT)
2. Loads every row into memory
3. Maps each row to a Java object
4. Returns the entire list

In practice, with 1 million records, it looks like this:

```java
// What you write:
List<Content> allContent = contentRepository.findAll();

// What happens under the hood:
// 1. Hibernate executes: SELECT * FROM content
// 2. Database returns 1,000,000 rows
// 3. Hibernate creates 1,000,000 Java objects
// 4. Each object might be 500 bytes
// 5. Total: 500 MB just for this query!
```

Every record gets loaded, even if the user only needs the first 20. This is by design when you use `findAll()` – it ensures everything is available.

### Why This Causes Performance Problems

This approach directly conflicts with how databases are designed to work efficiently. The PostgreSQL documentation explicitly recommends using `LIMIT` and `OFFSET` for large result sets. They emphasize that we should "only fetch data that the application really needs" to avoid memory exhaustion.

When you call `findAll()`, the framework:

1. **Loads everything into memory**: From the database's perspective, all records must be fetched
2. **Creates objects for everything**: Hibernate creates Java objects for each row
3. **Serializes everything**: Jackson serializes all objects to JSON
4. **Transfers everything**: All data goes over the network

In a production application where:

* The table might contain millions of records
* Multiple users might make requests simultaneously
* Memory is a limited resource

…this creates a **_perfect storm of performance problems_**. When a single endpoint loads millions of records, potentially gigabytes of memory get consumed just for one request.

### The OutOfMemoryError

The JVM can easily run out of memory:

```
Exception in thread "http-nio-8080-exec-1" java.lang.OutOfMemoryError: Java heap space
    at java.util.Arrays.copyOf(Arrays.java:3210)
    at java.util.ArrayList.grow(ArrayList.java:267)
    at java.util.ArrayList.ensureExplicitCapacity(ArrayList.java:241)
    at java.util.ArrayList.ensureCapacityInternal(ArrayList.java:233)
    at org.hibernate.collection.internal.PersistentBag.add(PersistentBag.java:287)
```

When scaled to multiple concurrent users, the application can crash entirely.

## The Pagination Solution

To solve this fundamental issue, we use `Pageable` to only fetch what we need:

```java
@RestController
@RequestMapping("/api/content")
public class ContentController {
    
    @Autowired
    private ContentRepository contentRepository;
    
    @GetMapping
    public Page<Content> getAllContent(
        @PageableDefault(size = 20) Pageable pageable
    ) {
        return contentRepository.findAll(pageable);  // ← Only 20 records!
    }
}
```

Pagination solves the problem by:

1. Still querying the database (following REST principles)
2. But only fetching a specific slice of data
3. Only loading intended records into memory

Pagination solves the problem by fetching only the data needed, avoiding memory exhaustion and improving performance.

## Under the Hood: How Pagination Works

Let me explain what actually happens when you use `Pageable`:

### What Happens When You Call `findAll(Pageable)`

When you write code like this:

```java
Page<Content> page = contentRepository.findAll(
    PageRequest.of(0, 20)  // Page 0, 20 records per page
);
```

Spring Data JPA does something interesting internally:

```
1. Spring Data JPA intercepts the call
2. Creates a Pageable object with page 0, size 20
3. Generates optimized SQL with LIMIT and OFFSET
4. Executes the query on the database
5. Executes a COUNT(*) query for total count
6. Returns a Page object with data + metadata
```

### The SQL Generated

Spring Data JPA transforms your Java code into optimized SQL:

```sql
-- Main query: only 20 records!
SELECT * FROM content 
LIMIT 20 OFFSET 0;

-- Count query: for metadata
SELECT COUNT(*) FROM content;
```

**Performance Comparison:**

| Approach | Records in Memory | Memory Used | Response Time | SQL Queries |
|-----------|---------------------|---------------|-------------------|-------------|
| `findAll()` | 1,000,000 | ~500 MB | 5-10 seconds | 1 query |
| `findAll(Pageable)` | 20 | ~10 KB | < 100ms | 2 queries |

**Result:** 99.998% less memory and 50-100x faster.

### Why This Matters

When you scale to millions of concurrent users, the difference between loading 1 million objects vs 20 objects in memory is **dramatic**:

```
Scenario: 1000 concurrent users

❌ Without pagination:
   1000 requests × 500 MB = 500 GB of RAM needed
   Result: OutOfMemoryError, application crashes

✅ With pagination:
   1000 requests × 10 KB = 10 MB of RAM needed
   Result: Stable application, fast response
```

## The Double-Query Problem

This "load everything" approach creates another significant performance issue: the need for a separate count query. Let me explain what happens:

### 1. The Data Query

Spring Data JPA needs to fetch the actual data:

```sql
SELECT * FROM content 
LIMIT 20 OFFSET 0;
```

This is fast – the database only needs to return 20 records.

### 2. The Count Query

But `Page` also provides metadata like total pages and total elements. To get this, Spring Data JPA executes:

```sql
SELECT COUNT(*) FROM content;
```

This can be slow on large tables because the database needs to count every row, even if you're only fetching 20.

### Why This Happens

Spring Data JPA needs both:
- The actual data (for `content`)
- The total count (for `totalElements`, `totalPages`)

This is why pagination uses 2 queries instead of 1. It's a trade-off: you get rich metadata, but at the cost of an additional database round trip.

### The Compounding Performance Hit

In a large application where:

* Multiple endpoints use pagination
* Users frequently navigate pages
* The count query runs on every request

…this creates a **_compound performance impact_**. Every page request triggers a `COUNT(*)` query, which can become a bottleneck.

## When OFFSET Gets Slow

Here's something important that many developers don't know: **OFFSET doesn't scale well for giant datasets**.

### The OFFSET Problem

The deeper the page, the slower it gets:

```sql
-- Page 1 (fast)
SELECT * FROM content LIMIT 20 OFFSET 0;
-- PostgreSQL only needs to order and return 20 records

-- Page 10,000 (slow!)
SELECT * FROM content LIMIT 20 OFFSET 200000;
-- PostgreSQL needs to:
-- 1. Order all records
-- 2. "Skip" the first 200,000 records
-- 3. Return the next 20
```

**Why?** PostgreSQL needs to order and "skip" records, which gets exponentially slower as you go deeper into pages.

### The Solution: Cursor-Based Pagination

For billions of records, use **cursor-based pagination** (also known as keyset pagination):

```java
// Instead of OFFSET, use a cursor (last seen ID)
Page<Content> findByContentTypeAndIdGreaterThan(
    ContentType contentType,
    Long lastId,
    Pageable pageable
);

// Generated SQL:
SELECT * FROM content 
WHERE contentType = 'MOVIE' AND id > 12345
ORDER BY id
LIMIT 20;
```

**Advantage:** Constant performance, regardless of page. The query always fetches the next 20 records after the last seen ID.

## DTO Conversion Overhead

When you use pagination with DTOs, there's a conversion step:

```java
Page<Content> contentPage = repository.findAll(pageable);
Page<ContentResponseDTO> dtoPage = contentPage.map(this::toDTO);
```

This `map()` operation creates new DTO objects for each entity. With 20 records per page, this is negligible. But it's worth noting that there's still overhead.

## Query Processing Overhead

In pagination, each page request involves processing overhead:

1. Processes the `Pageable` object
2. Generates SQL with `LIMIT` and `OFFSET`
3. Executes the query
4. Executes the count query
5. Converts results to DTOs

This is fast for small pages, but can become a bottleneck at scale.

## Object Creation Overhead

In Spring Boot, each paginated request creates:

- A `Page` object
- Multiple `Content` objects (20 per page)
- Multiple `ContentResponseDTO` objects (20 per page)

With pagination, this is minimal. Without pagination, creating 1 million objects is catastrophic.

## Real-World Impact

I've seen production applications where:

- A single `findAll()` call consumed 2 GB of memory
- The application crashed under load
- Response times were 10+ seconds

With pagination, the same application:
- Used 10 KB per request
- Handled 1000+ concurrent users
- Responded in < 100ms

The difference is **dramatic**.

## What Can We Learn From This?

This analysis shows how simple architectural decisions – like using pagination – have dramatic impacts on performance and scalability.

### Trade-offs

| Approach | Advantages | Disadvantages |
|-----------|-----------|---------------|
| **No Pagination** | Simple code, one query | OutOfMemoryError, slow |
| **Pagination with OFFSET** | Easy to implement, works well for few pages | Gets slow on deep pages |
| **Cursor-Based Pagination** | Constant performance, scales infinitely | More complex, can't "jump" pages |

### When to Use Each Approach?

**Use pagination with OFFSET when:**
- ✅ Users navigate sequential pages (1, 2, 3...)
- ✅ Don't need to go very deep (less than 10,000 pages)
- ✅ You want simplicity

**Use cursor-based pagination when:**
- ✅ Datasets of billions of records
- ✅ Constant performance is critical
- ✅ You can accept not being able to "jump" pages

## Final Thoughts

Pagination isn't just "nice to have" – it's **essential** for scalable applications. Spring Data JPA makes implementation easy, but it's important to understand what happens "under the hood" to make correct performance choices.

**Key takeaways:**
1. Pagination prevents OutOfMemoryError with millions of records
2. `Pageable` generates `LIMIT/OFFSET` SQL automatically
3. Indexes are crucial for performance with filters
4. For giant datasets, consider cursor-based pagination
5. Simple architectural decisions have dramatic performance impacts

The decision to use pagination isn't just about following best practices – it's about understanding how architectural choices ripple through your application. Every decision has trade-offs, and understanding those trade-offs is what separates good developers from great ones.

---

**Full project:** [Content-Catalog-API on GitHub](https://github.com/adelmonsouza/30DiasJava-Day02-ContentCatalogAPI)

**Next article:** Recommendation System Under the Hood: How HashMap and Jaccard Similarity Work (Day 3)

---

**#30DiasJava | #SpringBoot | #Performance | #Pagination | #Scalability**