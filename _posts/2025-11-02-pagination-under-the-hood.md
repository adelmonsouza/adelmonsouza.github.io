---
layout: default
title: "Paginação Eficiente no Spring Boot: Como Decisões de Design Previnem OutOfMemoryError"
date: 2025-11-02 00:00:00 +0000
categories: Performance Spring Boot
permalink: /blog/2025/11/02/pagination-under-the-hood.html
---

<div class="post-header">
    <h1 class="post-title">Paginação Eficiente no Spring Boot: Como Decisões de Design Previnem OutOfMemoryError</h1>
    <div class="post-meta">
        <span><i class="fas fa-calendar"></i> 02/11/2025</span>
        <span><i class="fas fa-user"></i> Adelmo Souza</span>
        <span><i class="fas fa-tag"></i> Performance, Spring Boot</span>
    </div>
</div>

<div class="post-content">

Hey there! Recentemente, enquanto construía o [Content-Catalog-API](https://github.com/adelmonsouza/30DiasJava-Day02-ContentCatalogAPI) – uma API inspirada no catálogo da Netflix ou Spotify – me deparei com um problema que muitos desenvolvedores Spring Boot enfrentam quando escalam suas aplicações: **como lidar com milhões de registros sem quebrar a memória?**

## Por Que Estou Olhando Para Isso?

**Full disclosure:** Eu já vi aplicações Spring Boot caírem com `OutOfMemoryError` porque simplesmente faziam `repository.findAll()` em tabelas com milhões de registros. É fácil de fazer, parece inofensivo, mas quando você escala, o resultado é catastrófico.

Este artigo não é apenas sobre "como fazer paginação" – já existem muitos tutoriais sobre isso. Em vez disso, vou examinar **como decisões arquiteturais influenciam performance ao longo do tempo**, usando paginação como estudo de caso. Meu objetivo é entender o que acontece "under the hood" quando você usa `Pageable` no Spring Data JPA.

## O Problema: Milhões de Registros na Memória

Imagine que você está construindo a API do catálogo da Netflix. Você precisa listar milhões de filmes, séries ou músicas. Se você simplesmente fizer `repository.findAll()`, o que acontece?

```java
// ❌ Código que parece inocente
List<Content> allContent = contentRepository.findAll();

// 💥 Resultado: OutOfMemoryError
// Exception in thread "main" java.lang.OutOfMemoryError: Java heap space
```

**Por quê?** Porque você está carregando 1 milhão de objetos na memória de uma vez. Em um cenário real, isso pode significar vários GB de memória só para uma query.

## Under the Hood: Como a Paginação Funciona

Vamos entender o que realmente acontece quando você usa `Pageable` no Spring Data JPA.

### O Que Acontece Quando Você Faz `findAll(Pageable)`

Quando você escreve código assim:

```java
Page<Content> page = contentRepository.findAll(
    PageRequest.of(0, 20)  // Página 0, 20 registros por página
);
```

O Spring Data JPA faz algo interessante internamente:

```
1. Spring Data JPA intercepta a chamada
2. Cria um objeto Pageable com página 0, tamanho 20
3. Gera SQL otimizado com LIMIT e OFFSET
4. Executa a query no banco de dados
5. Executa uma query COUNT(*) para o total
6. Retorna um objeto Page com dados + metadados
```

### O SQL Gerado

O Spring Data JPA transforma seu código Java em SQL otimizado:

```sql
-- Query principal: apenas 20 registros!
SELECT * FROM content 
LIMIT 20 OFFSET 0;

-- Query de contagem: para metadados
SELECT COUNT(*) FROM content;
```

**Comparação de Performance:**

| Abordagem | Registros na Memória | Memória Usada | Tempo de Resposta | Queries SQL |
|-----------|---------------------|---------------|-------------------|-------------|
| `findAll()` | 1.000.000 | ~500 MB | 5-10 segundos | 1 query |
| `findAll(Pageable)` | 20 | ~10 KB | < 100ms | 2 queries |

**Resultado:** 99.998% menos memória e 50-100x mais rápido.

### Por Que Isso Importa?

Quando você escala para milhões de usuários simultâneos, a diferença entre carregar 1 milhão de objetos vs 20 objetos na memória é **dramática**:

```
Cenário: 1000 usuários simultâneos

❌ Sem paginação:
   1000 requests × 500 MB = 500 GB de RAM necessária
   Resultado: OutOfMemoryError, aplicação cai

✅ Com paginação:
   1000 requests × 10 KB = 10 MB de RAM necessária
   Resultado: Aplicação estável, resposta rápida
```

## Implementação Prática: Content-Catalog-API

Vamos ver como implementar paginação eficiente no Spring Boot.

### 1. Repository com Paginação

O Spring Data JPA torna a paginação trivial:

```java
@Repository
public interface ContentRepository extends JpaRepository<Content, Long> {
    
    // Busca simples com paginação
    Page<Content> findByContentType(ContentType contentType, Pageable pageable);
    
    // Busca avançada com múltiplos filtros
    @Query("SELECT c FROM Content c WHERE " +
           "(:title IS NULL OR LOWER(c.title) LIKE LOWER(CONCAT('%', :title, '%'))) AND " +
           "(:contentType IS NULL OR c.contentType = :contentType) AND " +
           "(:genre IS NULL OR c.genre = :genre) AND " +
           "(:minYear IS NULL OR c.releaseYear >= :minYear) AND " +
           "(:maxYear IS NULL OR c.releaseYear <= :maxYear) AND " +
           "(:minRating IS NULL OR c.rating >= :minRating)")
    Page<Content> searchContent(
        @Param("title") String title,
        @Param("contentType") ContentType contentType,
        @Param("genre") String genre,
        @Param("minYear") Integer minYear,
        @Param("maxYear") Integer maxYear,
        @Param("minRating") Double minRating,
        Pageable pageable
    );
}
```

**Pontos importantes:**
- `Pageable` é injetado automaticamente pelo Spring
- `Page<Content>` retorna dados + metadados (total, página atual, etc.)
- O SQL gerado usa `LIMIT` e `OFFSET` automaticamente

### 2. Service Layer

O Service faz a conversão para DTOs e adiciona lógica de negócio:

```java
@Service
@Transactional(readOnly = true)
public class ContentService {
    
    private final ContentRepository contentRepository;
    
    public Page<ContentResponseDTO> searchContent(
        SearchRequestDTO searchRequest, 
        Pageable pageable
    ) {
        Page<Content> contentPage = contentRepository.searchContent(
            searchRequest.title(),
            searchRequest.contentType(),
            searchRequest.genre(),
            searchRequest.minYear(),
            searchRequest.maxYear(),
            searchRequest.minRating(),
            pageable
        );
        
        // Converter para DTOs usando map()
        return contentPage.map(this::toDTO);
    }
    
    private ContentResponseDTO toDTO(Content content) {
        return new ContentResponseDTO(
            content.getId(),
            content.getTitle(),
            content.getDescription(),
            content.getContentType(),
            content.getGenre(),
            content.getReleaseYear(),
            content.getRating()
        );
    }
}
```

### 3. Controller REST

O Controller recebe o `Pageable` automaticamente via query params:

```java
@RestController
@RequestMapping("/api/content")
@RequiredArgsConstructor
public class ContentController {
    
    private final ContentService contentService;
    
    @PostMapping("/search")
    @Operation(summary = "Buscar conteúdo", 
               description = "Busca conteúdo com filtros avançados e paginação")
    public ResponseEntity<Page<ContentResponseDTO>> searchContent(
        @RequestBody SearchRequestDTO searchRequest,
        @PageableDefault(size = 20, sort = "rating", direction = Sort.Direction.DESC) 
        Pageable pageable
    ) {
        Page<ContentResponseDTO> results = contentService.searchContent(
            searchRequest, 
            pageable
        );
        return ResponseEntity.ok(results);
    }
}
```

**Anotações importantes:**
- `@PageableDefault`: Define padrões (tamanho da página, ordenação)
- `Pageable` é injetado automaticamente via query params:
  - `?page=0&size=20&sort=rating,DESC`

### Configuração Global

No `application.properties`:

```properties
# Pagination Configuration
spring.data.web.pageable.default-page-size=20
spring.data.web.pageable.max-page-size=100
spring.data.web.pageable.page-parameter=page
spring.data.web.pageable.size-parameter=size
```

**O que isso faz:**
- **default-page-size:** Se não especificar `size`, usa 20
- **max-page-size:** Limite máximo (evita abusos: `size=10000`)
- **page-parameter:** Nome do query param (padrão: `page`)
- **size-parameter:** Nome do query param (padrão: `size`)

## Resposta da API: Estrutura de `Page`

Quando você retorna `Page<ContentResponseDTO>`, o Spring Boot serializa assim:

```json
{
  "content": [
    {
      "id": 1,
      "title": "Stranger Things",
      "contentType": "SERIES",
      "rating": 8.7
    }
    // ... mais 19 itens
  ],
  "pageable": {
    "pageNumber": 0,
    "pageSize": 20,
    "sort": {
      "sorted": true,
      "unsorted": false,
      "empty": false
    }
  },
  "totalElements": 1500000,
  "totalPages": 75000,
  "last": false,
  "first": true,
  "size": 20,
  "number": 0,
  "numberOfElements": 20,
  "empty": false
}
```

**Campos úteis:**
- `content`: Array com os dados da página atual
- `totalElements`: Total de registros no banco
- `totalPages`: Total de páginas
- `last`: É a última página?
- `first`: É a primeira página?

## Performance: Quando OFFSET Fica Lento?

Aqui está algo importante que muitos desenvolvedores não sabem: **OFFSET não escala bem para datasets gigantes**.

### O Problema do OFFSET

Quanto mais profunda a página, mais lento fica:

```sql
-- Página 1 (rápido)
SELECT * FROM content LIMIT 20 OFFSET 0;
-- PostgreSQL precisa apenas ordenar e retornar 20 registros

-- Página 10.000 (lento!)
SELECT * FROM content LIMIT 20 OFFSET 200000;
-- PostgreSQL precisa:
-- 1. Ordenar todos os registros
-- 2. "Pular" os primeiros 200.000 registros
-- 3. Retornar os próximos 20
```

**Por quê?** O PostgreSQL precisa ordenar e "pular" registros, o que fica exponencialmente mais lento conforme você vai mais fundo nas páginas.

### A Solução: Cursor-Based Pagination

Para bilhões de registros, use **cursor-based pagination** (também conhecido como keyset pagination):

```java
// Em vez de OFFSET, use um cursor (último ID visto)
Page<Content> findByContentTypeAndIdGreaterThan(
    ContentType contentType,
    Long lastId,
    Pageable pageable
);

// SQL gerado:
SELECT * FROM content 
WHERE contentType = 'MOVIE' AND id > 12345
ORDER BY id
LIMIT 20;
```

**Vantagem:** Performance constante, independente da página. A query sempre busca os próximos 20 registros após o último ID visto.

## Índices: Acelerando Queries com Filtros

Índices são cruciais para performance quando você usa filtros. Vamos ver por quê.

### Por Que Índices Importam?

Sem índices, uma busca por `contentType = 'MOVIE'` precisa **varrer toda a tabela**:

```sql
-- Sem índice: Sequential Scan (lento!)
EXPLAIN SELECT * FROM content WHERE contentType = 'MOVIE';
-- Seq Scan on content  (cost=0.00..18334.00 rows=... width=...)
-- Tempo: ~2 segundos para 1 milhão de registros

-- Com índice: Index Scan (rápido!)
CREATE INDEX idx_content_type ON content(contentType);
EXPLAIN SELECT * FROM content WHERE contentType = 'MOVIE';
-- Index Scan using idx_content_type  (cost=0.43..8.45 rows=... width=...)
-- Tempo: ~10ms para 1 milhão de registros
```

**Resultado:** 200x mais rápido!

### Definindo Índices no JPA

Você pode definir índices diretamente na entidade:

```java
@Entity
@Table(name = "content", indexes = {
    @Index(name = "idx_content_type", columnList = "contentType"),
    @Index(name = "idx_content_genre", columnList = "genre"),
    @Index(name = "idx_content_rating", columnList = "rating"),
    @Index(name = "idx_content_year", columnList = "releaseYear")
})
public class Content {
    // ...
}
```

**Dica:** Crie índices para campos que você filtra frequentemente. Mas cuidado: índices tornam writes mais lentos (trade-off).

## O Que Podemos Aprender Com Isso?

Esta análise mostra como decisões arquiteturais simples – como usar paginação – têm impactos dramáticos em performance e escalabilidade.

### Trade-offs

| Abordagem | Vantagens | Desvantagens |
|-----------|-----------|--------------|
| **Sem Paginação** | Código simples, uma query | OutOfMemoryError, lento |
| **Paginação com OFFSET** | Fácil de implementar, funciona bem para poucas páginas | Fica lento em páginas profundas |
| **Cursor-Based Pagination** | Performance constante, escala infinitamente | Mais complexo, não permite "pular" páginas |

### Quando Usar Cada Abordagem?

**Use paginação com OFFSET quando:**
- ✅ Usuários navegam páginas sequenciais (1, 2, 3...)
- ✅ Não precisa ir muito fundo (menos de 10.000 páginas)
- ✅ Você quer simplicidade

**Use cursor-based pagination quando:**
- ✅ Datasets de bilhões de registros
- ✅ Performance constante é crítica
- ✅ Você pode aceitar não poder "pular" páginas

## Lições Aprendidas

### 1. Sempre Use Paginação para Listagens

**Regra de ouro:** Se você pode ter mais de 100 registros, use paginação.

```java
// ❌ Errado
List<Content> all = repository.findAll();

// ✅ Correto
Page<Content> page = repository.findAll(PageRequest.of(0, 20));
```

### 2. Configure Limites Máximos

Evite abusos como `size=100000`:

```properties
spring.data.web.pageable.max-page-size=100
```

### 3. Use Índices para Filtros Frequentes

Queries com filtros (`WHERE contentType = 'MOVIE'`) ficam muito mais rápidas com índices.

### 4. Considere Cursor-Based para Datasets Gigantes

Para bilhões de registros, `OFFSET` fica inviável. Use cursor-based pagination.

## Conclusão

Paginação não é apenas "bom ter" – é **essencial** para aplicações escaláveis. O Spring Data JPA facilita muito a implementação, mas é importante entender o que acontece "under the hood" para fazer escolhas corretas de performance.

**Principais takeaways:**
1. Paginação evita OutOfMemoryError com milhões de registros
2. `Pageable` gera SQL `LIMIT/OFFSET` automaticamente
3. Índices são cruciais para performance com filtros
4. Para datasets gigantes, considere cursor-based pagination
5. Decisões arquiteturais simples têm impactos dramáticos em performance

---

**Código completo:** [Content-Catalog-API no GitHub](https://github.com/adelmonsouza/30DiasJava-Day02-ContentCatalogAPI)

**Próximo artigo:** Sistema de Recomendações com Collaborative Filtering (Dia 3)

---

**#30DiasJava | #SpringBoot | #Performance | #Pagination | #Scalability**

</div>