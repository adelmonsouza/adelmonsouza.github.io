# 📝 Setup de Comentários e Reações

## ✅ O Que Foi Implementado

### 1. Sistema de Comentários (Utterances)
- **Utterances** usa GitHub Discussions para comentários
- **Gratuito** e funciona perfeitamente com GitHub Pages
- Comentários aparecem como issues no seu repositório

### 2. Sistema de Reações
- **4 tipos de reações:**
  - 👍 **Useful** - Artigo foi útil
  - ❤️ **Loved it** - Amei o artigo
  - 🎓 **Learned** - Aprendi algo novo
  - ✅ **Applied** - Já apliquei isso

- **Armazenamento:** localStorage (sem backend necessário)
- **Persistência:** Reações ficam salvas por post

---

## 🔧 Setup Utterances (Comentários)

### Passo 1: Instalar Utterances App no GitHub

1. Acesse: https://github.com/apps/utterances
2. Clique em **"Install"**
3. Selecione o repositório: `adelmonsouza/adelmonsouza.github.io`
4. Clique em **"Install"**

### Passo 2: Habilitar Discussions no Repositório

1. No GitHub, vá para: `adelmonsouza/adelmonsouza.github.io`
2. Vá em **Settings** → **General**
3. Role até **"Features"**
4. ✅ Marque **"Discussions"**
5. Clique em **"Save changes"**

### Passo 3: Verificar Configuração

O código já está configurado em `_includes/comments.html`:
- Repo: `adelmonsouza/adelmonsouza.github.io`
- Theme: `github-light`
- Issue term: `pathname` (usa o caminho do post)

**Pronto!** Os comentários aparecerão automaticamente nos posts.

---

## 🎨 Sistema de Reações

### Como Funciona:
- **Clique uma vez:** Adiciona reação
- **Clique novamente:** Remove reação
- **Armazenamento:** localStorage do navegador
- **Persistência:** Mesmo navegador manterá as reações

### Customização:

Você pode modificar as reações em `_includes/comments.html`:

```html
<button class="reaction-btn reaction-like" data-reaction="like">
    <span class="reaction-icon">👍</span>
    <span class="reaction-count" id="like-count">0</span>
    <span class="reaction-label">Useful</span>
</button>
```

---

## 📊 Estatísticas (Futuro)

Para adicionar analytics nas reações, você pode:

1. **Usar Google Analytics**
2. **Criar uma API simples** (opcional)
3. **Usar GitHub Issues** para tracking (mais complexo)

Por enquanto, as reações ficam no localStorage (prático e sem backend).

---

## ✅ Teste

1. Acesse qualquer post: https://enouveau.io/blog/2025/11/01/dtos-under-the-hood.html
2. Role até o final
3. Veja os botões de reação
4. Teste clicando (localStorage salvará)
5. Comentários aparecerão após configurar Utterances

---

## 🐛 Troubleshooting

### Comentários não aparecem?
- ✅ Verifique se Utterances app está instalado
- ✅ Verifique se Discussions está habilitado no repo
- ✅ Verifique se o repo está correto em `_includes/comments.html`

### Reações não funcionam?
- ✅ Abra o Console do navegador (F12)
- ✅ Verifique se há erros JavaScript
- ✅ Teste em modo anônimo (localStorage funciona)

---

**Pronto! Sistema de comentários e reações implementado! 🎉**


