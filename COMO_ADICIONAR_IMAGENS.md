# 📸 Como Adicionar Imagens nos Posts - The Java Place

## 🎯 Estrutura SwiftyPlace Completa

Agora o blog tem **EXATAMENTE** o layout do SwiftyPlace:
- ✅ Layout 2 colunas (conteúdo + sidebar TOC)
- ✅ Sidebar com Table of Contents automático
- ✅ Foto do autor com data de publicação
- ✅ Design responsivo
- ✅ Estilo idêntico ao SwiftyPlace

---

## 📝 Passo 1: Adicionar Foto do Autor

### No GitHub Pages:

1. **Adicione sua foto** em `assets/images/author.jpg`
   - Tamanho recomendado: 50x50px (ou quadrado)
   - Formato: JPG ou PNG
   - Circular (será cortado automaticamente)

2. **Ou use uma imagem placeholder temporária:**
   ```bash
   # Crie uma imagem simples ou use um avatar
   # O layout suporta sem foto (fica invisível)
   ```

---

## 🖼️ Passo 2: Adicionar Imagens nos Posts

### Opção 1: Imagens Locais

1. **Coloque as imagens** em `assets/images/posts/`
   - Exemplo: `assets/images/posts/dto-flow-diagram.png`

2. **No post Markdown, use:**
   ```markdown
   ![Diagrama: Fluxo DTO](../assets/images/posts/dto-flow-diagram.png)
   ```

### Opção 2: Imagens Externas (CDN/URL)

```markdown
![Diagrama: Arquitetura](https://via.placeholder.com/800x400?text=Diagrama+Arquitetura)
```

### Opção 3: Diagramas ASCII (no estilo SwiftyPlace)

```markdown
## Como Funciona

```
┌─────────────────────────────────────────┐
│ HTTP Request (JSON)                     │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ Controller (Thin)                       │
│ - Receives DTO                          │
│ - Delegates to Service                  │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ Service (Fat)                           │
│ - Business logic                        │
└─────────────────────────────────────────┘
```

---

## 🎨 Exemplos de Imagens Úteis

### Para o Post sobre DTOs:
1. **Diagrama de arquitetura** (Controller → Service → Repository)
2. **Fluxo de dados** (JSON → DTO → Entity)
3. **Comparação visual** (com DTO vs sem DTO)

### Para o Post sobre Paginação:
1. **Gráfico de performance** (com/sem paginação)
2. **Diagrama SQL** (LIMIT/OFFSET)
3. **Ilustração de memória** (OutOfMemoryError)

---

## 📋 Checklist para Novo Post

- [ ] Layout: `layout: post` (não `default`)
- [ ] Foto do autor em `assets/images/author.jpg`
- [ ] Título no front matter
- [ ] Data formatada corretamente
- [ ] Imagens adicionadas (opcional mas recomendado)
- [ ] Headings (h2, h3) para gerar TOC automático
- [ ] Sem divs HTML nos posts (apenas Markdown puro)

---

## 🔗 Estrutura Final

```
adelmonsouza.github.io/
├── _layouts/
│   ├── default.html (homepage)
│   └── post.html (posts com sidebar TOC) ✅
├── assets/
│   ├── css/
│   │   └── custom.css (estilo SwiftyPlace) ✅
│   ├── js/
│   │   └── toc.js (TOC automático) ✅
│   └── images/
│       ├── author.jpg (foto do autor) ⏳ ADICIONAR
│       └── posts/ (imagens dos posts)
├── _posts/
│   ├── 2025-11-01-dtos-under-the-hood.md ✅
│   └── 2025-11-02-pagination-under-the-hood.md ✅
└── _config.yml ✅
```

---

## ✅ Status Atual

- ✅ Layout post.html criado
- ✅ Sidebar TOC implementada
- ✅ CSS SwiftyPlace completo
- ✅ JavaScript TOC automático
- ✅ Posts atualizados (layout: post)
- ⏳ Foto do autor (você precisa adicionar)
- ⏳ Imagens/diagramas nos posts (opcional)

---

**Agora o blog está EXATAMENTE como o SwiftyPlace!** 🎉


