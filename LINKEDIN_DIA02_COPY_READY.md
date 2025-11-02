# 📋 Post LinkedIn DIA 2 - PRONTO PARA COPIAR E COLAR

**📅 Data: 02/11/2025 (Postar HOJE após o post do dia 1)**

**Copie TODO o texto abaixo e cole diretamente no LinkedIn:**

---

🚀 **Dia 2/30 do #30DiasJava: DTOs não são opcionais!**

Hoje aprendi algo crucial: muitos devs expõem entidades JPA diretamente no Controller, e isso é um risco de segurança real.

**O que descobri:**
Mass Assignment Attack. Se você aceita `@RequestBody User user` no Controller, um atacante pode enviar campos que não deveriam ser modificáveis (ex: `role: ADMIN`, `id: 999`).

**Under the Hood:**
O Spring Boot faz binding automático do JSON para a entidade. Se a entidade tem um campo `role`, e o JSON tem `role`, o Spring vai popular - mesmo que você não queira.

**A solução:**
DTOs (Data Transfer Objects) desacoplam a API da camada de dados. Você define exatamente quais campos podem ser recebidos e enviados.

```java
// ✅ Correto: DTO específico
public record UserCreateDTO(
    String email,
    String password,
    String fullName
) {}

// ❌ Errado: Entidade JPA exposta
@PostMapping
public User createUser(@RequestBody User user) { ... }
```

**Por que isso importa:**
Além de segurança, DTOs permitem evolução da API sem quebrar clientes, controlam exatamente quais dados são serializados (evitando LazyInitializationException), e separam responsabilidades (Controller magro, Service musculoso).

Próximo: Dia 3 - Content Catalog API com paginação eficiente.

🔗 Veja o código completo: github.com/adelmonsouza/user-profile-service

---

#Java #SpringBoot #30DiasJava #CleanCode #Security #DTO #AdelmoDev

---

**💡 Publique entre 9h-11h ou 15h-17h. Se já postou o dia 1, aguarde pelo menos 4 horas antes de postar este!**

