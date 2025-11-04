---
layout: post
title: "Recommendation Engine: Collaborative Filtering, JPA Patterns, and Performance Optimization"
date: 2025-11-03
author: "Adelmon Souza"
categories: ["Algorithms", "Spring Boot", "Architecture"]
tags: ["recommendation-engine", "collaborative-filtering", "spring-boot", "java", "jpa", "algorithms"]
excerpt: "Learn how to build a recommendation engine microservice using Spring Boot, focusing on collaborative filtering algorithms, data consistency patterns, and performance optimization strategies used by BigTech companies."
---

**Note**: I couldn't publish this yesterday because my internet service provider was down. This actually ties perfectly into today's topic: **system availability and resilience**. When recommendation systems face connectivity issues, service outages, or external dependencies going offline, they need robust fallback mechanisms—just like how we need alternative ways to connect when our primary connection fails. More on this later.

Hey there! So I've been diving into recommendation systems lately, and it's been quite the journey. Building a system that suggests the right content to users – similar to what Amazon and Netflix do – requires understanding not just algorithms, but also how to make them scale and perform in production.

**Disclaimer**: This article is not a critique of Spring Boot or JPA – both are excellent tools. Rather, this is an analysis of how architectural decisions influence performance and scalability in recommendation systems, using collaborative filtering as a case study. My goal is to examine the relationship between algorithm design, database patterns, and performance outcomes, including resilience strategies for when things go wrong.

## Why I'm Looking at This

**Full disclosure**: I've built recommendation features before, but honestly, I've made the mistake of loading everything into memory and not considering the performance implications at scale. But that's not because recommendation systems are complex – it's just that the challenges aren't always obvious when you're starting out.

That said, recommendation engines make for a fascinating case study. After building several production Spring Boot applications, I've learned that **performance at scale isn't something that just happens automatically. You really have to work for it,** _right?_ And architectural choices can either make that easier or… well, much harder.

So I thought it would be interesting to look at what happens when you build recommendation systems, see where developers struggle with performance and scalability, and connect those struggles back to the core architectural decisions. Not to criticize an approach, but to learn from it – because these lessons apply to any architecture we might design or adopt.

During a performance audit on one of my projects, I discovered that generating recommendations for 10,000 users took over 5 minutes, consuming significant memory and CPU resources. When scaled to production with millions of users, that approach simply wouldn't work.

It's worth noting that this isn't just theoretical – many production recommendation systems have struggled with performance because they simply loaded too much data into memory or used inefficient algorithms.

But why is that happening? Let's break down how recommendation systems work and where performance challenges arise:

## The Foundation: Collaborative Filtering

Collaborative filtering is one of the most common approaches to building recommendation systems. The core idea is simple: **if User A and User B have similar preferences, items that User B likes (but User A hasn't seen yet) are good recommendations for User A**.

### How It Works

When you use collaborative filtering:

1. **Build User Profiles**: Each user's ratings create a "profile" of their preferences
2. **Find Similar Users**: Compare profiles to find users with similar tastes
3. **Recommend Items**: Suggest items that similar users liked, but the target user hasn't rated yet
4. **Calculate Scores**: Each recommendation gets a score based on how likely the user is to like it

In practice, it looks like this:

```
User A rated: [Movie1: 5, Movie2: 4, Movie3: 5]
User B rated: [Movie1: 5, Movie2: 4, Movie4: 5]

Similarity detected! 
Recommend Movie4 to User A (User B liked it)
Recommend Movie3 to User B (User A liked it)
```

### The Database Design

Our recommendation engine uses four core entities:

```java
@Entity
@Table(name = "ratings", indexes = {
    @Index(name = "idx_rating_user_item", columnList = "user_id,item_id", unique = true),
    @Index(name = "idx_rating_item", columnList = "item_id")
})
public class Rating {
    @ManyToOne(fetch = FetchType.LAZY)
    private User user;
    
    @ManyToOne(fetch = FetchType.LAZY)
    private Item item;
    
    private Integer score; // 1-5
}
```

**Key Design Decisions**:

1. **Lazy Loading**: Using `FetchType.LAZY` prevents N+1 query problems when loading relationships, as recommended in the [Spring Data JPA documentation](https://docs.spring.io/spring-data/jpa/docs/current/reference/html/#jpa.entity-graph)
2. **Composite Index**: Unique index on `(user_id, item_id)` prevents duplicate ratings and enables fast lookups, following PostgreSQL indexing best practices
3. **Normalized Average**: Storing `averageRating` on Item entity for O(1) access instead of calculating on-the-fly, reducing computational overhead
4. **Timestamp Tracking**: All entities track creation time for temporal analysis and auditing purposes

## The Algorithm: Calculating Recommendation Scores

Here's how our collaborative filtering algorithm works:

```java
private Map<UUID, Double> calculateCollaborativeFilteringScores(UUID targetUserId) {
    // Get items already rated by target user
    Set<UUID> ratedItems = getRatedItems(targetUserId);
    
    // For each unrated item, calculate score
    Map<UUID, Double> itemScores = new HashMap<>();
    
    for (UUID itemId : allItems) {
        if (ratedItems.contains(itemId)) continue; // Skip already rated
        
        // Base score from average rating
        Item item = itemRepository.findById(itemId).orElse(null);
        if (item == null || item.getAverageRating() == null) continue;
        
        double score = item.getAverageRating() / 5.0; // Normalize to 0-1
        
        // Boost score if user has rated similar items in same category
        long sameCategoryRatings = targetUserRatings.keySet().stream()
            .map(id -> itemRepository.findById(id).orElse(null))
            .filter(Objects::nonNull)
            .filter(i -> i.getCategory().equals(item.getCategory()))
            .count();
        
        if (sameCategoryRatings > 0) {
            score += 0.1; // Boost for category similarity
        }
        
        itemScores.put(itemId, Math.min(1.0, score));
    }
    
    return itemScores;
}
```

### Why This Matters

The algorithm complexity is **O(n × m)** where:
- **n** = number of items
- **m** = number of users

For a system with 1 million items and 100,000 users, that's **100 billion comparisons**! Without optimization, this would be prohibitively slow.

## The Performance Challenge

### The N+1 Query Problem

When generating recommendations, you might be tempted to do this:

```java
// ❌ BAD: N+1 queries
List<Item> items = itemRepository.findAll();
for (Item item : items) {
    List<Rating> ratings = ratingRepository.findByItemId(item.getId());
    // Calculate score...
}
```

**What happens:**
1. 1 query to get all items
2. N queries (one per item) to get ratings
3. Total: 1 + N queries

For 10,000 items, that's **10,001 database queries**!

### The Solution: Batch Queries

```java
// ✅ GOOD: Single query with JOIN (following JPQL syntax from Spring Data JPA documentation)
@Query("SELECT i, AVG(r.score) as avgRating " +
       "FROM Item i LEFT JOIN i.ratings r " +
       "GROUP BY i.id")
List<Object[]> findItemsWithAverageRatings();

// Or use projection interface
@Query("SELECT i.id as itemId, AVG(r.score) as avgRating " +
       "FROM Item i LEFT JOIN i.ratings r " +
       "GROUP BY i.id")
List<ItemRatingProjection> findItemRatings();
```

This reduces 10,001 queries to **1 query**!

## Transaction Management: Ensuring Consistency

Recommendation generation must be atomic – either all recommendations are created or none are. Here's how we handle it:

```java
@Transactional
public void generateRecommendations(UUID userId, String algorithm) {
    // 1. Delete existing recommendations atomically
    recommendationRepository.deleteByUserId(userId);
    
    // 2. Calculate new scores (outside transaction if heavy)
    Map<UUID, Double> scores = calculateScores(userId);
    
    // 3. Save all recommendations in one transaction
    List<Recommendation> recommendations = scores.entrySet().stream()
        .sorted(Map.Entry.<UUID, Double>comparingByValue().reversed())
        .limit(50)
        .map(entry -> {
            Recommendation rec = new Recommendation();
            rec.setUser(userRepository.findById(userId).orElseThrow());
            rec.setItem(itemRepository.findById(entry.getKey()).orElseThrow());
            rec.setScore(entry.getValue());
            rec.setAlgorithm(algorithm);
            return rec;
        })
        .collect(Collectors.toList());
    
    recommendationRepository.saveAll(recommendations);
}
```

**Best Practices** (aligned with [Spring Framework documentation](https://docs.spring.io/spring-framework/reference/data-access/transaction.html)):

- ✅ Use `@Transactional` on service methods for consistency, as recommended in the Spring documentation
- ✅ Keep transactions short to avoid lock contention and improve performance
- ✅ Consider async processing for heavy calculations using `@Async` and `CompletableFuture`
- ✅ Use `@Transactional(readOnly = true)` for query-only operations to enable read-only optimizations

## Pagination: Don't Load Everything

Even recommendations should be paginated:

```java
@GetMapping("/recommendations/user/{userId}")
public Page<RecommendationResponse> getRecommendations(
        UUID userId, 
        Pageable pageable) {
    return recommendationRepository
        .findByUserIdOrderByScoreDesc(userId, pageable);
}
```

This generates SQL with `LIMIT` and `OFFSET`:

```sql
SELECT * FROM recommendations 
WHERE user_id = ? 
ORDER BY score DESC 
LIMIT 20 OFFSET 0;
```

**Result**: Only 20 recommendations loaded into memory, not thousands.

## Performance Optimization Strategies

### 1. Database Indexes

Critical indexes for performance:

```sql
CREATE INDEX idx_rating_user_item ON ratings(user_id, item_id);
CREATE INDEX idx_recommendation_user_score ON recommendations(user_id, score DESC);
CREATE INDEX idx_item_category ON items(category);
```

**Performance Impact**:
- Without index: O(n) table scan
- With index: O(log n) lookup

### 2. Caching

Cache generated recommendations using Spring Cache abstraction:

```java
@Cacheable(value = "recommendations", key = "#userId")
public List<Recommendation> getCachedRecommendations(UUID userId) {
    return recommendationRepository
        .findByUserIdOrderByScoreDesc(userId, PageRequest.of(0, 50))
        .getContent();
}
```

**TTL Strategy** (following [Spring Cache documentation](https://docs.spring.io/spring-framework/reference/integration/cache.html)):
- Item catalog: 1 hour
- Recommendations: 24 hours
- Average ratings: 1 hour

**Resilience Note**: When external services are unavailable (like my ISP yesterday), cached recommendations ensure users still receive suggestions. This is a critical pattern for maintaining availability during outages.

### 3. Batch Processing

For large-scale recommendation generation, following [Spring's async execution patterns](https://docs.spring.io/spring-framework/reference/integration/scheduling.html#scheduling-annotation-support-async):

```java
@Async
public CompletableFuture<Void> generateRecommendationsBatch(
        List<UUID> userIds) {
    // Process in batches of 100
    int batchSize = 100;
    for (int i = 0; i < userIds.size(); i += batchSize) {
        List<UUID> batch = userIds.subList(i, 
            Math.min(i + batchSize, userIds.size()));
        batch.parallelStream()
            .forEach(userId -> generateRecommendations(userId, "collaborative-filtering"));
    }
    return CompletableFuture.completedFuture(null);
}
```

### 4. Resilience Patterns

When external dependencies fail (like network connectivity issues), recommendation systems should degrade gracefully:

```java
@CircuitBreaker(name = "recommendation-service", fallbackMethod = "getFallbackRecommendations")
public List<Recommendation> getRecommendations(UUID userId) {
    return recommendationService.getCachedRecommendations(userId);
}

public List<Recommendation> getFallbackRecommendations(UUID userId, Exception e) {
    // Fallback to popular items when service is unavailable
    log.warn("Recommendation service unavailable, using fallback", e);
    return itemRepository.findTop50ByOrderByAverageRatingDesc();
}
```

## Testing with Testcontainers

Integration tests with real database:

```java
@SpringBootTest
@Testcontainers
class RecommendationIntegrationTest {
    
    @Container
    static PostgreSQLContainer<?> postgres = 
        new PostgreSQLContainer<>("postgres:15")
            .withDatabaseName("testdb")
            .withUsername("postgres")
            .withPassword("postgres");
    
    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
    
    @Test
    void generateRecommendations_createsValidSuggestions() {
        // Test with real database
        User user = userService.createUser(new UserRequest("test@example.com", "Test"));
        Item item = itemService.createItem(new ItemRequest("Item", "Desc", "Category"));
        
        ratingService.createOrUpdateRating(new RatingRequest(
            user.getId().toString(), 
            item.getId().toString(), 
            5, "Great!"));
        
        recommendationService.generateRecommendations(user.getId(), "collaborative-filtering");
        
        Page<RecommendationResponse> recs = recommendationService
            .getRecommendations(user.getId(), PageRequest.of(0, 10));
        
        assertThat(recs.getContent()).isNotEmpty();
    }
}
```

**Benefits**:
- ✅ Real database behavior
- ✅ Isolated test environments
- ✅ Reproducible test results

## Real-World Impact

I've seen production recommendation systems where:

* Generating recommendations for 1 user took 30+ seconds
* Memory consumption was 2+ GB per request
* The system couldn't handle more than 10 concurrent users

With proper optimization:

* Recommendation generation: < 1 second
* Memory usage: < 100 MB per request
* Handles 1000+ concurrent users

The difference is **dramatic**.

## What Can We Learn From This?

This analysis shows how architectural decisions in recommendation systems have dramatic impacts on performance and scalability.

### Trade-offs

| Approach | Advantages | Disadvantages |
|----------|------------|---------------|
| **Simple Collaborative Filtering** | Easy to implement, intuitive | Slow at scale, O(n×m) complexity |
| **Optimized with Indexes** | Fast lookups, scales better | Requires careful index design |
| **With Caching** | Very fast for repeated requests | Cache invalidation complexity |
| **Batch Processing** | Handles large volumes | More complex, async overhead |

### When to Use Each Approach?

**Use simple collaborative filtering when:**
* ✅ Small dataset (< 10,000 items)
* ✅ Few users (< 1,000)
* ✅ Prototyping or MVP

**Use optimized approach when:**
* ✅ Production system
* ✅ Large dataset (> 100,000 items)
* ✅ Many users (> 10,000)

**Use caching when:**
* ✅ Recommendations don't change frequently
* ✅ High read-to-write ratio
* ✅ Performance is critical

## Final Thoughts

Building recommendation systems isn't just about algorithms – it's about **making them scale and perform** in production, even when dependencies fail. Spring Boot and JPA make implementation easy, but it's important to understand what happens "under the hood" to make correct performance and resilience choices.

**Key takeaways:**

1. Collaborative filtering is powerful but can be slow at scale
2. Database indexes are crucial for performance
3. Pagination prevents memory exhaustion
4. Caching dramatically improves response times and provides resilience during outages
5. Batch processing handles large volumes efficiently
6. Simple architectural decisions have dramatic performance impacts
7. **Resilience matters**: When services fail (like network connectivity), cached data and fallback mechanisms ensure users still get recommendations

The decision to optimize isn't just about following best practices – it's about understanding how architectural choices ripple through your application. Every decision has trade-offs, and understanding those trade-offs is what separates good developers from great ones. And when your ISP goes down (like mine did yesterday), having resilient systems with proper caching and fallback mechanisms means your users never notice the difference.

---

**Full project:** [Recommendation Engine on GitHub](https://github.com/adelmonsouza/30DiasJava-Day03-RecommendationEngine)

**Next article:** Notification Service: Event-Driven Architecture Patterns (Day 4-5)

---

| **#30DiasJava | #SpringBoot | #Algorithms | #CollaborativeFiltering | #Microservices** |
| --------------- | ----------- | ----------- | ----------------------- | ----------------- |

---

## Comments

Want to share your thoughts or ask a question? Comments are powered by GitHub Discussions. [Join the discussion →](https://github.com/adelmonsouza/30DiasJava-Day03-RecommendationEngine/discussions)

Did you find this article useful?

👍 0 Useful ❤️ 0 Loved it 🎓 0 Learned ✅ 0 Applied



