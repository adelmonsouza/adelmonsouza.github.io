---
layout: default
title: "DTOs, Entidades e O Segredo do Controller Magro: Como Decisões Arquiteturais Impactam Segurança e Performance"
date: 2025-11-01 00:00:00 +0000
categories: Arquitetura Spring Boot
permalink: /blog/2025/11/01/dtos-under-the-hood.html
---

Hey there! So I've been diving into architectural patterns lately, and it's been quite the journey. I wanted to share some thoughts on how the design decisions we make can have these ripple effects throughout our applications – especially when it comes to security and performance.

**Disclaimer**: This article is not a critique of Spring Boot or JPA – both are excellent tools. Rather, this is an analysis of how architectural decisions influence security and performance over time, using DTOs as a case study. My goal is to examine the relationship between design principles and practical outcomes, and extract lessons that apply to any architecture we might create or adopt.

## Why I'm Looking at This

**Full disclosure**: I haven't always used DTOs in my Spring Boot projects, and honestly, I've made the mistake of exposing entities directly more times than I'd like to admit. But that's not because DTOs are complex – it's just that the benefits aren't always obvious when you're starting out.

That said, this pattern makes for a fascinating case study. After building several production Spring Boot applications, I've learned that **security and performance aren't things that just happen automatically. You really have to work for them,** _right?_ And architectural choices can either make that easier or… well, much harder.

So I thought it would be interesting to look at what happens when you expose entities directly, see where developers struggle, and connect those struggles back to the core architectural decisions. Not to criticize an approach, but to learn from it – because these lessons apply to any architecture we might design or adopt.

During a security audit on one of my projects, I discovered that exposing JPA entities directly allowed attackers to manipulate fields that shouldn't be modifiable. A single `@RequestBody User user` in a controller created a **Mass Assignment vulnerability** that could have led to privilege escalation. That's… not great.

It's worth noting that this isn't just theoretical – the OWASP Top 10 lists Mass Assignment as a common vulnerability, and Spring Boot applications are particularly susceptible when entities are exposed directly.

But why is that happening? Let's break down how exposing entities directly translates to security and performance challenges:

### The Foundation: Exposing JPA Entities Directly

First, let's understand what happens when you expose an entity directly. In Spring Boot, it's tempting to do this:

```java
@RestController
@RequestMapping("/api/users")
public class UserController {
    
    @Autowired
    private UserRepository userRepository;
    
    @GetMapping("/{id}")
    public User getUser(@PathVariable Long id) {
        return userRepository.findById(id).orElseThrow();
    }
    
    @PostMapping
    public User createUser(@RequestBody User user) {
        return userRepository.save(user);
    }
}
```

This code works. It's simple. It's clean. But here's the problem: **the JPA entity represents your database model, not your API contract**.

### The Critical Rule: Entities Contain Everything

When you expose an entity directly, you're exposing everything – all fields, relationships, metadata, everything. This is a fundamental architectural decision that creates cascading problems.

In practice, it looks like this:

```java
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String email;
    
    private String password;  // ← Should NEVER be exposed!
    
    private String fullName;
    
    @Enumerated(EnumType.STRING)
    private Role role;  // ← Should be controlled by the system!
    
    @OneToMany(fetch = FetchType.LAZY)
    private List<Order> orders;  // ← Can cause N+1 queries!
    
    // ... more fields
}
```

Every field in this entity becomes part of your API contract. This is by design when you expose the entity directly – it ensures everything is accessible.

### Why This Causes Security Problems

This approach directly conflicts with security best practices. The OWASP Foundation explicitly warns against Mass Assignment vulnerabilities. They emphasize that we should "only expose fields that the API really needs" to prevent unauthorized modifications.

When you accept `@RequestBody User user`, the Spring Framework:

1. **Uses Jackson to deserialize the JSON**: Jackson uses reflection to populate the entity
2. **Validates annotations**: Spring validates `@NotNull`, `@Email`, etc.
3. **Populates ALL matching fields**: If the JSON contains a field, Jackson tries to set it
4. **Saves directly**: The repository saves the entity with all populated fields

In a production application where:

* The entity might contain sensitive fields (`password`, `role`)
* The entity might have fields that shouldn't be modifiable (`id`, `createdAt`)
* Multiple clients consume the API with different permissions

…this creates a **_perfect storm of security vulnerabilities_**. When a single field is exposed incorrectly, potentially millions of users' data could be compromised.

### The Mass Assignment Attack

An attacker can easily exploit this:

```bash
POST /api/users
{
  "email": "attacker@evil.com",
  "password": "weakpassword",
  "role": "ADMIN",  # ← Privilege escalation!
  "id": 999         # ← Can overwrite existing user!
}
```

If the Controller accepts `@RequestBody User user`, Jackson will populate the `role` field, even though you never intended that to be modifiable. The system might save a user with `ADMIN` role, even though only the backend should assign roles.

## The DTO Solution

To solve this fundamental issue, we use DTOs (Data Transfer Objects) that only expose specific fields:

```java
// DTO for creating a user
public record UserCreateDTO(
    @NotBlank String email,
    @NotBlank @Size(min = 8) String password,
    @NotBlank String fullName
    // Note: role and id don't exist here!
) {}

// DTO for responding to clients
public record UserResponseDTO(
    Long id,
    String email,
    String fullName,
    Role role,
    LocalDateTime createdAt
    // Note: password is never exposed!
) {}
```

DTOs try to solve the problem by:

1. Still receiving the request (following REST principles)
2. But only exposing specific, controlled fields
3. Only allowing modifications to intended fields

While this helps, it's essentially a solution for a problem created by exposing entities directly. It adds classes and conversions, but it solves issues that wouldn't exist with DTOs from the start.

## Why This Also Causes Performance Problems

You might be thinking: "But why does this affect performance?" Great question. Let's see what happens when you expose entities directly.

### The Lazy Loading Problem

JPA entities can have relationships with `FetchType.LAZY`:

```java
@Entity
public class User {
    @OneToMany(fetch = FetchType.LAZY)
    private List<Order> orders;
    
    @ManyToOne(fetch = FetchType.LAZY)
    private Address address;
}
```

When you return the entity directly from a controller, Hibernate needs to resolve these relationships. This can cause:

1. **LazyInitializationException**: If the JPA session is already closed
2. **N+1 Query Problem**: Multiple queries to the database

```java
// ❌ Problem: N+1 queries
@GetMapping("/{id}")
public User getUser(@PathVariable Long id) {
    User user = repository.findById(id).orElseThrow();
    // When Jackson tries to serialize user.getOrders(),
    // Hibernate makes a query for each order!
    return user;  // LazyInitializationException or N+1
}

// ✅ Solution: DTOs control exactly what's serialized
@GetMapping("/{id}")
public UserResponseDTO getUser(@PathVariable Long id) {
    User user = repository.findById(id).orElseThrow();
    // Convert to DTO BEFORE returning
    return toResponseDTO(user);  // No lazy relationships
}
```

### The Serialization Overhead

When you return an entity directly, Jackson needs to:

1. Use reflection to access all fields
2. Check lazy relationships
3. Serialize fields you may not want to expose

With DTOs, you control exactly what's serialized, reducing overhead.

## The Elegant Solution: Controller Magro, Service Musculoso

This is where we make a critical architectural decision: **the Controller should be thin, and the Service should be fat**.

### The Controller: Keeping It Thin

The Controller should be the simplest layer. It only does four things:

```java
@RestController
@RequestMapping("/api/users")
public class UserController {
    
    private final UserService userService;
    
    public UserController(UserService userService) {
        this.userService = userService;
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<UserResponseDTO> getUser(@PathVariable Long id) {
        UserResponseDTO user = userService.findById(id);
        return ResponseEntity.ok(user);
    }
    
    @PostMapping
    public ResponseEntity<UserResponseDTO> createUser(
            @Valid @RequestBody UserCreateDTO dto) {
        UserResponseDTO created = userService.create(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
```

**The Controller does:**
- ✅ Receives the DTO from the request
- ✅ Validates basic input (`@Valid`)
- ✅ Delegates to the Service
- ✅ Returns the DTO response
- ✅ Handles HTTP status

**The Controller does NOT:**
- ❌ Complex business validation
- ❌ Entity to DTO conversion
- ❌ Direct repository access
- ❌ Business logic

### The Service: Where the Magic Happens

The Service is where all business logic lives. This is where you do validations, conversions, and business rules:

```java
@Service
public class UserService {
    
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    
    public UserResponseDTO findById(Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new UserNotFoundException(id));
        return toResponseDTO(user);
    }
    
    public UserResponseDTO create(UserCreateDTO dto) {
        // Business validation: unique email
        if (userRepository.existsByEmail(dto.email())) {
            throw new EmailAlreadyExistsException(dto.email());
        }
        
        // Convert DTO → Entity (explicit and controlled)
        User user = new User();
        user.setEmail(dto.email());
        user.setPassword(passwordEncoder.encode(dto.password()));
        user.setFullName(dto.fullName());
        user.setRole(Role.USER);  // Default - NOT from DTO!
        
        User saved = userRepository.save(user);
        return toResponseDTO(saved);
    }
    
    private UserResponseDTO toResponseDTO(User user) {
        return new UserResponseDTO(
            user.getId(),
            user.getEmail(),
            user.getFullName(),
            user.getRole(),
            user.getCreatedAt()
            // Note: password is NEVER exposed!
        );
    }
}
```

**The Service does:**
- ✅ Business rule validation
- ✅ DTO → Entity conversion (input)
- ✅ Entity → DTO conversion (output)
- ✅ Business logic
- ✅ Repository interaction

## What Can We Learn From This?

This analysis shows how simple architectural decisions – like exposing entities directly vs using DTOs – have dramatic impacts on security and performance.

### Trade-offs

| Approach | Advantages | Disadvantages |
|-----------|-----------|---------------|
| **Entities Directly** | Quick to write, fewer classes | Security vulnerabilities, performance issues, tight coupling |
| **DTOs** | Security, performance, loose coupling | More code, more classes, manual conversions |

### When to Use Each Approach?

**Use DTOs when:**
- ✅ Public APIs (REST APIs)
- ✅ Multiple clients consume the API
- ✅ Security is critical
- ✅ Performance is important
- ✅ The data model changes frequently

**Entities directly might work when:**
- Internal applications only
- Quick prototypes
- Private APIs with full trust

## Final Thoughts

DTOs are not just "nice to have" – they're **essential** for security, performance, and maintainability. The Controller should be thin, the Service should be fat, and the JPA entity should be invisible to the outside world.

**Key takeaways:**
1. DTOs prevent Mass Assignment Attacks
2. DTOs improve performance (avoid N+1 queries and lazy loading)
3. DTOs decouple the data model from the API contract
4. Thin Controllers + Fat Services = scalable architecture

The decision to use DTOs isn't just about following best practices – it's about understanding how architectural choices ripple through your application. Every decision has trade-offs, and understanding those trade-offs is what separates good developers from great ones.

---

**Full project:** [User-Profile-Service on GitHub](https://github.com/adelmonsouza/30DiasJava-Day01-UserProfileService)

**Next article:** Efficient Pagination in Spring Boot: How to Avoid OutOfMemoryError (Day 2)

---

**#30DiasJava | #SpringBoot | #Architecture | #DTO | #Security | #Performance**