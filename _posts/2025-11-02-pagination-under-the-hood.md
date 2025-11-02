---
layout: post
title: "Paginação Eficiente no Spring Boot: Como Evitar OutOfMemoryError"
date: 2025-11-02 00:00:00 +0000
categories: Performance Spring Boot
permalink: /blog/2025/11/02/pagination-under-the-hood.html
---

# Paginação Eficiente no Spring Boot: Como Evitar OutOfMemoryError

## Uma Análise Under The Hood

**Data:** 02/11/2025  
**Autor:** Adelmo Souza  
**Categoria:** Performance, Spring Boot

---

## Introdução: O Problema dos Milhões de Registros

Imagine que você está construindo a API do catálogo da Netflix ou Spotify. Você precisa listar milhões de filmes, séries ou músicas. Se você simplesmente fizer `repository.findAll()`, o que acontece?

```java
// ❌ Código que parece inocente
List<Content> allContent = contentRepository.findAll();

// 💥 Resultado: OutOfMemoryError
// Exception in thread "main" java.lang.OutOfMemoryError: Java heap space
```

**Por quê?** Porque você está carregando 1 milhão de objetos na memória de uma vez. Em um cenário real, isso pode significar vários GB de memória só para uma query.

**Solução:** Paginação eficiente com Spring Data JPA.

---

## Under the Hood: Como a Paginação Funciona

### O Que Acontece Quando Você Faz `findAll(Pageable)`

Quando você usa `Pageable` no Spring Data JPA, o framework gera **SQL otimizado** automaticamente:

```java
// No seu código Java:
Page<Content> page = contentRepository.findAll(
    PageRequest.of(0, 20)  // Página 0, 20 registros por página
);

// O Spring Data JPA gera este SQL:
SELECT * FROM content 
LIMIT 20 OFFSET 0;  // Apenas 20 registros!

// E também conta o total:
SELECT COUNT(*) FROM content;
```

**Comparação:**

| Abordagem | Registros na Memória | Memória Usada | Tempo de Resposta |
|-----------|---------------------|---------------|-------------------|
| `findAll()` | 1.000.000 | ~500 MB | 5-10 segundos |
| `findAll(Pageable)` | 20 | ~10 KB | < 100ms |

**Resultado:** 99.998% menos memória e 50-100x mais rápido.

---

## Implementação Prática: Content-Catalog-API

### 1. Repository com Paginação

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
        
        // Converter para DTOs
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

---

## Configuração Global

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

---

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
    },
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

---

## Performance: Quando OFFSET Fica Lento?

### O Problema do OFFSET

Quanto mais profunda a página, mais lento fica:

```sql
-- Página 1 (rápido)
SELECT * FROM content LIMIT 20 OFFSET 0;

-- Página 10.000 (lento!)
SELECT * FROM content LIMIT 20 OFFSET 200000;
-- PostgreSQL precisa "pular" 200.000 registros!
```

**Por quê?** O PostgreSQL precisa:
1. Ordenar todos os registros
2. "Pular" os primeiros 200.000 registros
3. Retornar os próximos 20

### Solução para Datasets Gigantes: Cursor-Based Pagination

Para bilhões de registros, use **cursor-based pagination**:

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

**Vantagem:** Performance constante, independente da página.

---

## Índices: Acelerando Queries com Filtros

### Por Que Índices Importam?

Sem índices, uma busca por `contentType = 'MOVIE'` precisa **varrer toda a tabela**:

```sql
-- Sem índice: Sequential Scan (lento!)
EXPLAIN SELECT * FROM content WHERE contentType = 'MOVIE';
-- Seq Scan on content  (cost=0.00..18334.00 rows=... width=...)

-- Com índice: Index Scan (rápido!)
CREATE INDEX idx_content_type ON content(contentType);
EXPLAIN SELECT * FROM content WHERE contentType = 'MOVIE';
-- Index Scan using idx_content_type  (cost=0.43..8.45 rows=... width=...)
```

### Definindo Índices no JPA

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

**Resultado:** Queries 10-100x mais rápidas com filtros.

---

## Testes: Garantindo que Paginação Funciona

```java
@Test
void testPagination_ShouldReturnOnly20Items() {
    // Given: 100 itens no banco
    for (int i = 0; i < 100; i++) {
        contentRepository.save(createContent("Title " + i));
    }
    
    // When: Buscar primeira página
    Page<Content> page = contentRepository.findAll(
        PageRequest.of(0, 20)
    );
    
    // Then
    assertThat(page.getContent()).hasSize(20);
    assertThat(page.getTotalElements()).isEqualTo(100);
    assertThat(page.getTotalPages()).isEqualTo(5);
    assertThat(page.isFirst()).isTrue();
    assertThat(page.isLast()).isFalse();
}

@Test
void testPagination_WithFilters_ShouldWorkCorrectly() {
    // Given
    contentRepository.save(createMovie("Avengers"));
    contentRepository.save(createSeries("Stranger Things"));
    
    // When: Buscar apenas filmes
    Page<Content> page = contentRepository.findByContentType(
        ContentType.MOVIE,
        PageRequest.of(0, 20)
    );
    
    // Then
    assertThat(page.getContent()).allMatch(c -> 
        c.getContentType() == ContentType.MOVIE
    );
}
```

---

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

---

## Próximos Passos

- **Cache (Redis):** Cachear resultados de buscas frequentes
- **Full-Text Search:** Busca textual avançada com PostgreSQL FTS ou Elasticsearch
- **Cursor-Based Pagination:** Para datasets de bilhões de registros

---

## Conclusão

Paginação não é apenas "bom ter" — é **essencial** para aplicações escaláveis. O Spring Data JPA facilita muito a implementação, mas é importante entender o que acontece "under the hood" para fazer escolhas corretas de performance.

**Principais takeaways:**
1. Paginação evita OutOfMemoryError com milhões de registros
2. `Pageable` gera SQL `LIMIT/OFFSET` automaticamente
3. Índices são cruciais para performance com filtros
4. Para datasets gigantes, considere cursor-based pagination

---

**Código completo:** [content-catalog-api](https://github.com/adelmonsouza/content-catalog-api)

---

**Próximo artigo:** Sistema de Recomendações com Collaborative Filtering (Dia 3)

---

**#30DiasJava | #SpringBoot | #Performance | #Pagination | #Scalability**

