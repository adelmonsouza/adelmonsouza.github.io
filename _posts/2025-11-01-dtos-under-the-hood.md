---
layout: post
title: "Deep-Dive: DTOs, Entidades e O Segredo do Controller Magro no Spring Boot"
date: 2025-11-01 00:00:00 +0000
categories: Arquitetura Spring Boot
permalink: /blog/2025/11/01/dtos-under-the-hood.html
---

# Deep-Dive: DTOs, Entidades e O Segredo do Controller Magro no Spring Boot

## Uma Análise Under The Hood

**Data:** 01/11/2025  
**Autor:** Adelmo Souza  
**Categoria:** Arquitetura, Spring Boot

---

## Introdução: O Mito do 'Controller Gordo'

Se você já trabalhou com Spring Boot, provavelmente já viu (ou até escreveu) código assim:

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

**O problema?** Estamos expondo a entidade `User` diretamente na API. Isso parece inofensivo, mas é uma falha de arquitetura com implicações graves de segurança e acoplamento.

---

## DTOs em Detalhe: Por que o Acoplamento Dói?

### O que é um DTO?

DTO (Data Transfer Object) é um padrão de design que cria objetos simples usados exclusivamente para transferir dados entre camadas ou sistemas. No contexto de APIs REST, DTOs são a interface entre o mundo externo e nossa aplicação.

### Por que usar DTOs?

#### 1. Segurança (Mass Assignment Attack)

Quando você expõe uma entidade JPA diretamente, um atacante pode fazer:

```bash
POST /api/users
{
  "email": "user@example.com",
  "password": "123456",
  "role": "ADMIN",  # ← Isso não deveria ser possível!
  "id": 999         # ← Manipulação de ID
}
```

Se o Controller aceita `@RequestBody User user`, o Spring pode popular campos que você não queria que fossem modificáveis.

**Com DTOs:**

```java
public record UserCreateDTO(
    @NotBlank String email,
    @NotBlank @Size(min = 8) String password,
    @NotBlank String fullName
) {}
```

Apenas esses campos podem ser enviados. `role` e `id` não existem no DTO, então não podem ser manipulados.

#### 2. Desacoplamento (Single Responsibility)

A entidade JPA deve representar o **modelo de dados**. Ela tem anotações específicas de banco (`@Entity`, `@Table`, `@ManyToOne`, etc.).

O DTO deve representar o **contrato da API**. Ele tem validações de negócio (`@NotBlank`, `@Email`, `@Size`).

Misturar esses dois conceitos viola o princípio de responsabilidade única.

#### 3. Performance (Lazy Loading)

Entidades JPA podem ter relacionamentos `@ManyToOne` ou `@OneToMany` com `FetchType.LAZY`. Quando você retorna a entidade diretamente no Controller, o Hibernate pode lançar `LazyInitializationException` ou fazer queries N+1 automaticamente.

DTOs permitem controlar exatamente quais dados são serializados.

#### 4. Evolução da API (Versionamento)

Sua entidade muda? Você adiciona um campo novo no banco? Se expõe a entidade diretamente, todos os clientes da API precisam se adaptar imediatamente.

Com DTOs, você pode manter múltiplas versões da API e fazer migrations graduais.

---

## O Padrão: Controller Magro, Service Musculoso

### Estrutura Correta

```
Requisição HTTP
    ↓
Controller (Thin) → Recebe DTO, valida entrada básica
    ↓
Service (Fat) → Executa lógica de negócio, valida regras complexas
    ↓
Repository → Acesso a dados, retorna Entidade
    ↓
Service → Converte Entidade para DTO
    ↓
Controller → Retorna DTO
    ↓
Resposta HTTP
```

### Exemplo Prático: User-Profile-Service

#### Controller (Magro)

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

**O Controller só faz:**
1. Recebe o DTO da requisição
2. Delega para o Service
3. Retorna o DTO da resposta
4. Trata status HTTP

**O Controller NÃO faz:**
- Validação de negócio complexa
- Conversão de Entidade para DTO
- Acesso direto ao Repository
- Lógica de negócio

#### Service (Musculoso)

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
        // Validação de negócio
        if (userRepository.existsByEmail(dto.email())) {
            throw new EmailAlreadyExistsException(dto.email());
        }
        
        // Criação da entidade
        User user = new User();
        user.setEmail(dto.email());
        user.setPassword(passwordEncoder.encode(dto.password()));
        user.setFullName(dto.fullName());
        user.setRole(Role.USER); // Default, não vem do DTO!
        
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
        );
    }
}
```

**O Service faz:**
1. Validação de regras de negócio
2. Conversão DTO → Entidade (input)
3. Conversão Entidade → DTO (output)
4. Lógica de negócio
5. Interação com Repository

---

## Segurança e DTOs: A Análise Crítica

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
) {}

// DTO para RESPONDER ao cliente (output)
public record UserResponseDTO(
    Long id,
    String email,
    String fullName,
    Role role,
    LocalDateTime createdAt
) {}
```

**Por que?**

1. **UserCreateDTO:** Campos obrigatórios para criar
2. **UserUpdateDTO:** Campos opcionais para atualizar (PATCH)
3. **UserResponseDTO:** Não expõe `password`, adiciona campos calculados como `createdAt`

---

## Conclusão e Próximos Passos

DTOs não são "nice to have" - são essenciais para segurança, desacoplamento e manutenibilidade. O Controller deve ser magro, o Service deve ser musculoso, e a entidade JPA deve ser invisível para o mundo externo.

**Princípios fundamentais:**
- ✅ DTOs para todas as APIs públicas
- ✅ Controllers apenas delegam
- ✅ Services contêm a lógica
- ✅ Entidades nunca saem da camada de Repository

**Próximo Deep-Dive:**
Na próxima semana, vamos explorar "Spring Security + JWT Under the Hood": como funciona a autenticação stateless, o que acontece internamente quando você usa `@PreAuthorize`, e por que JWT é diferente de sessions tradicionais.

---

**🔗 Projeto relacionado:** [User-Profile-Service no GitHub](https://github.com/adelmonsouza/user-profile-service)

**📚 Referências:**
- Spring Boot Official Documentation
- OWASP Mass Assignment
- Clean Architecture by Robert C. Martin

---

**#Java #SpringBoot #CleanCode #Architecture #DTO #Security**

</div>
