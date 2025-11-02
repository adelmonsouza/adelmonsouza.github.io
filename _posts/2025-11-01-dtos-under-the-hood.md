---
layout: default
title: "DTOs, Entidades e O Segredo do Controller Magro: Como Decisões Arquiteturais Impactam Segurança e Performance"
date: 2025-11-01 00:00:00 +0000
categories: Arquitetura Spring Boot
permalink: /blog/2025/11/01/dtos-under-the-hood.html
---

<div class="post-header">
    <h1 class="post-title">DTOs, Entidades e O Segredo do Controller Magro: Como Decisões Arquiteturais Impactam Segurança e Performance</h1>
    <div class="post-meta">
        <span><i class="fas fa-calendar"></i> 01/11/2025</span>
        <span><i class="fas fa-user"></i> Adelmo Souza</span>
        <span><i class="fas fa-tag"></i> Arquitetura, Spring Boot</span>
    </div>
</div>

<div class="post-content">

Hey there! Então, eu tenho mergulhado em padrões arquiteturais ultimamente, e tem sido uma jornada interessante. Queria compartilhar algumas reflexões sobre como as decisões de design que fazemos podem ter efeitos cascata em nossas aplicações – especialmente quando se trata de segurança e performance.

Recentemente, enquanto construía o [User-Profile-Service](https://github.com/adelmonsouza/user-profile-service), me deparei com uma situação que muitos desenvolvedores Spring Boot já viveram: a tentação de expor entidades JPA diretamente nas APIs REST.

## Por Que Estou Olhando Para Isso?

**Full disclosure:** Eu já cometi esse erro mais vezes do que gostaria de admitir. Quando você está começando com Spring Boot, é tentador fazer código assim:

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

**Parece simples, certo?** Funciona. Os testes passam. O código é limpo. Mas aqui está o problema: essa abordagem cria vulnerabilidades de segurança, problemas de performance e acoplamento que só aparecem quando você escala a aplicação.

Este artigo não é uma crítica ao Spring Boot ou JPA – ambos são excelentes ferramentas. Em vez disso, é uma análise de **como decisões arquiteturais influenciam segurança e performance ao longo do tempo**, usando DTOs como estudo de caso. Meu objetivo é examinar a relação entre princípios de design e resultados práticos.

## O Problema Fundamental: Expondo Entidades JPA

Quando você expõe uma entidade JPA diretamente na API, você está criando uma ponte direta entre seu modelo de banco de dados e o mundo externo. Isso pode parecer inofensivo, mas tem implicações profundas.

### O Que Acontece "Under the Hood"

Quando o Spring Boot recebe um `@RequestBody User user`, ele usa Jackson para deserializar o JSON. Aqui está o que acontece internamente:

```
1. Cliente envia JSON:
   {
     "email": "user@example.com",
     "password": "123456",
     "role": "ADMIN",  ← Campo que não deveria ser modificável!
     "id": 999         ← Manipulação de ID!
   }

2. Jackson usa reflection para preencher a entidade User
3. O Spring valida anotações (@NotNull, @Email, etc.)
4. O Controller recebe um objeto User completo
5. O Repository salva diretamente no banco
```

**O problema?** Se a entidade `User` tem um campo `role`, o Jackson vai tentar popular esse campo, mesmo que você não queira que ele seja modificável pelo cliente.

Isso é conhecido como **Mass Assignment Attack** e está listado no [OWASP Top 10](https://owasp.org/www-project-top-ten/).

### A Vulnerabilidade em Ação

Um atacante pode fazer:

```bash
POST /api/users
{
  "email": "attacker@evil.com",
  "password": "weakpassword",
  "role": "ADMIN",  # ← Escalação de privilégios!
  "id": 1           # ← Pode sobrescrever usuário existente!
}
```

Se o Controller aceita `@RequestBody User user` sem validação adequada, o Spring pode popular campos que você não queria que fossem modificáveis.

## A Solução: DTOs (Data Transfer Objects)

DTO é um padrão de design que cria objetos simples usados exclusivamente para transferir dados entre camadas. No contexto de APIs REST, DTOs são a **interface** entre o mundo externo e nossa aplicação.

### Por Que DTOs Resolvem o Problema?

Vamos ver o que acontece "under the hood" quando usamos DTOs:

```
1. Cliente envia JSON:
   {
     "email": "user@example.com",
     "password": "123456",
     "fullName": "John Doe"
     // Note: role e id NÃO EXISTEM neste DTO!
   }

2. Jackson deserializa para UserCreateDTO (um record simples)
3. O Controller valida o DTO (@Valid)
4. O Service recebe o DTO e faz a conversão explícita
5. O Service cria a entidade User com apenas os campos permitidos
6. O Repository salva no banco
```

**Com DTOs, apenas os campos que existem no DTO podem ser enviados.** `role` e `id` não existem no `UserCreateDTO`, então não podem ser manipulados, mesmo que alguém tente.

### Implementação Prática

```java
// DTO para CRIAR usuário (input)
public record UserCreateDTO(
    @NotBlank String email,
    @NotBlank @Size(min = 8) String password,
    @NotBlank String fullName
    // Note: role e id não estão aqui!
) {}

// DTO para RESPONDER ao cliente (output)
public record UserResponseDTO(
    Long id,
    String email,
    String fullName,
    Role role,
    LocalDateTime createdAt
    // Note: password nunca é exposto!
) {}
```

## O Padrão Arquitetural: Controller Magro, Service Musculoso

Esta é uma das decisões arquiteturais mais importantes que você pode fazer em uma aplicação Spring Boot. Vamos ver como ela funciona na prática.

### A Estrutura Correta

```
┌─────────────────────────────────────────────────────────┐
│ Requisição HTTP (JSON)                                   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Controller (Thin)                                        │
│ - Recebe DTO                                            │
│ - Valida entrada básica (@Valid)                     │
│ - Delega para Service                                 │
│ - Retorna DTO                                         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Service (Fat)                                            │
│ - Valida regras de negócio                              │
│ - Converte DTO → Entidade                               │
│ - Executa lógica de negócio                             │
│ - Interage com Repository                               │
│ - Converte Entidade → DTO                               │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Repository                                               │
│ - Acesso a dados                                        │
│ - Retorna Entidade                                      │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Resposta HTTP (JSON)                                     │
└─────────────────────────────────────────────────────────┘
```

### O Controller: Mantendo-o Magro

O Controller deve ser a camada mais simples da aplicação. Ele só deve fazer 4 coisas:

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

**O Controller faz:**
- ✅ Recebe o DTO da requisição
- ✅ Valida entrada básica (`@Valid`)
- ✅ Delega para o Service
- ✅ Retorna o DTO da resposta
- ✅ Trata status HTTP

**O Controller NÃO faz:**
- ❌ Validação de negócio complexa
- ❌ Conversão de Entidade para DTO
- ❌ Acesso direto ao Repository
- ❌ Lógica de negócio

### O Service: Onde a Mágica Acontece

O Service é onde toda a lógica de negócio vive. É aqui que você faz validações complexas, conversões e regras de negócio:

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
        // Validação de negócio: email único
        if (userRepository.existsByEmail(dto.email())) {
            throw new EmailAlreadyExistsException(dto.email());
        }
        
        // Conversão DTO → Entidade (explícita e controlada)
        User user = new User();
        user.setEmail(dto.email());
        user.setPassword(passwordEncoder.encode(dto.password()));
        user.setFullName(dto.fullName());
        user.setRole(Role.USER); // Default - NÃO vem do DTO!
        
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
            // Note: password nunca é exposto!
        );
    }
}
```

**O Service faz:**
- ✅ Validação de regras de negócio
- ✅ Conversão DTO → Entidade (input)
- ✅ Conversão Entidade → DTO (output)
- ✅ Lógica de negócio
- ✅ Interação com Repository

## Por Que Isso Causa Problemas de Performance?

Você pode estar pensando: "Mas por que isso afeta performance?" Boa pergunta. Vamos ver o que acontece quando você expõe entidades diretamente.

### O Problema do Lazy Loading

Entidades JPA podem ter relacionamentos com `FetchType.LAZY`:

```java
@Entity
public class User {
    @OneToMany(fetch = FetchType.LAZY)
    private List<Order> orders;
    
    @ManyToOne(fetch = FetchType.LAZY)
    private Address address;
}
```

Quando você retorna a entidade diretamente no Controller, o Hibernate precisa resolver esses relacionamentos. Isso pode causar:

1. **LazyInitializationException**: Se a sessão JPA já foi fechada
2. **N+1 Query Problem**: Múltiplas queries ao banco de dados

```java
// ❌ Problema: N+1 queries
@GetMapping("/{id}")
public User getUser(@PathVariable Long id) {
    User user = repository.findById(id).orElseThrow();
    // Quando Jackson tenta serializar user.getOrders(),
    // o Hibernate faz uma query por cada pedido!
    return user; // LazyInitializationException ou N+1
}

// ✅ Solução: DTOs controlam exatamente o que é serializado
@GetMapping("/{id}")
public UserResponseDTO getUser(@PathVariable Long id) {
    User user = repository.findById(id).orElseThrow();
    // Converter para DTO ANTES de retornar
    return toResponseDTO(user); // Sem relacionamentos lazy
}
```

### O Custo de Serialização

Quando você retorna uma entidade diretamente, o Jackson precisa:

1. Usar reflection para acessar todos os campos
2. Verificar relacionamentos lazy
3. Serializar campos que você pode não querer expor

Com DTOs, você controla exatamente o que é serializado, reduzindo overhead.

## Segurança: A Análise Crítica

DTOs são essenciais para segurança. Vamos ver por quê:

### DTOs Diferentes para Operações Diferentes

Você deve ter DTOs específicos para cada operação:

```java
// DTO para CRIAR usuário (input)
public record UserCreateDTO(
    @NotBlank String email,
    @NotBlank @Size(min = 8) String password,
    @NotBlank String fullName
) {}

// DTO para ATUALIZAR usuário (input)
public record UserUpdateDTO(
    String fullName,  // Opcional
    String password   // Opcional
    // Note: email não pode ser alterado!
) {}

// DTO para RESPONDER ao cliente (output)
public record UserResponseDTO(
    Long id,
    String email,
    String fullName,
    Role role,
    LocalDateTime createdAt
    // Note: password nunca é exposto!
) {}
```

**Por que DTOs diferentes?**

1. **UserCreateDTO**: Campos obrigatórios para criar
2. **UserUpdateDTO**: Campos opcionais para atualizar (PATCH)
3. **UserResponseDTO**: Não expõe `password`, adiciona campos calculados

### Evitando Mass Assignment

Com DTOs, você garante que apenas campos específicos podem ser modificados:

```java
// ❌ Sem DTO: vulnerável
@PostMapping
public User createUser(@RequestBody User user) {
    // Atacante pode enviar role="ADMIN"
    return repository.save(user);
}

// ✅ Com DTO: seguro
@PostMapping
public UserResponseDTO createUser(@Valid @RequestBody UserCreateDTO dto) {
    // role não existe no DTO, então não pode ser enviado
    User user = new User();
    user.setRole(Role.USER); // Sempre USER, não importa o que o cliente envie
    return toResponseDTO(repository.save(user));
}
```

## O Que Podemos Aprender Com Isso?

Esta análise não é sobre criticar uma abordagem específica – é sobre entender os trade-offs nas decisões arquiteturais.

### Trade-offs

| Abordagem | Vantagens | Desvantagens |
|-----------|-----------|--------------|
| **Entidades Diretamente** | Código rápido de escrever, menos classes | Vulnerabilidades de segurança, problemas de performance, acoplamento |
| **DTOs** | Segurança, performance, desacoplamento | Mais código, mais classes, conversões manuais |

### Quando Usar Cada Abordagem?

**Use DTOs quando:**
- ✅ Aplicações públicas (APIs REST)
- ✅ Múltiplos clientes consomem a API
- ✅ Segurança é crítica
- ✅ Performance é importante
- ✅ O modelo de dados muda frequentemente

**Entidades diretamente pode funcionar quando:**
- Aplicações internas simples
- Protótipos rápidos
- APIs privadas com confiança total

## Lições Aprendidas

### 1. Sempre Use DTOs para APIs Públicas

**Regra de ouro:** Se a API será consumida por clientes externos, use DTOs. Sem exceções.

### 2. Controllers Devem Ser Magros

O Controller é a camada mais simples. Ele só recebe e delega. Toda a lógica vai no Service.

### 3. Services Contêm a Lógica

O Service é onde você faz validações, conversões e regras de negócio. É o "cérebro" da aplicação.

### 4. Entidades Nunca Saem da Camada de Repository

A entidade JPA deve ser invisível para o mundo externo. Ela só existe dentro da aplicação.

## Conclusão

DTOs não são apenas "nice to have" – são **essenciais** para segurança, desacoplamento e manutenibilidade. O Controller deve ser magro, o Service deve ser musculoso, e a entidade JPA deve ser invisível para o mundo externo.

**Principais takeaways:**
1. DTOs previnem Mass Assignment Attacks
2. DTOs melhoram performance (evitam N+1 queries e lazy loading)
3. DTOs desacoplam o modelo de dados da API
4. Controller magro + Service musculoso = arquitetura escalável

---

**Código completo:** [User-Profile-Service no GitHub](https://github.com/adelmonsouza/30DiasJava-Day01-UserProfileService)

**Próximo artigo:** Paginação Eficiente no Spring Boot: Como Evitar OutOfMemoryError (Dia 2)

---

**#30DiasJava | #SpringBoot | #Architecture | #DTO | #Security | #Performance**

</div>