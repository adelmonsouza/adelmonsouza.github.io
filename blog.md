---
layout: default
title: Blog
permalink: /blog/
---

<section class="blog-hero">
  <div class="blog-hero-inner">
    <p class="blog-label">🚀 The Java Place</p>
    <h1>By Adelmon Souza</h1>
    <p class="blog-lead">Deep Dives in Java &amp; Spring Boot — sem fluff.<br>Conteúdo inteligente, direto ao ponto, criado para desenvolvedores que querem ir além do básico.</p>
  </div>
</section>

<section class="blog-navigation container">
  <h2 class="section-title">🧭 Explore</h2>
  <div class="nav-grid">
    <a class="nav-card" href="/">
      <span class="nav-icon">🏠</span>
      <div>
        <h3>Home</h3>
        <p>Visão geral, roadmap e progress bar #30DiasJava.</p>
      </div>
    </a>
    <a class="nav-card" href="/resources/">
      <span class="nav-icon">🧩</span>
      <div>
        <h3>Resources</h3>
        <p>DTOs, Config Server, Observability, Resilience4j.</p>
      </div>
    </a>
    <a class="nav-card" href="/blog/">
      <span class="nav-icon">🧱</span>
      <div>
        <h3>Architecture Blog</h3>
        <p>Artigos técnicos e guias avançados.</p>
      </div>
    </a>
    <a class="nav-card" href="/about">
      <span class="nav-icon">🧑‍💻</span>
      <div>
        <h3>About</h3>
        <p>Conheça quem está por trás do projeto.</p>
      </div>
    </a>
  </div>
</section>

<section class="container blog-listing">
  <header class="blog-heading">
    <h2>📚 Blog – The Java Place</h2>
    <p>Artigos técnicos, deep-dives e práticas de arquitetura moderna em Java e Spring Boot.</p>
  </header>
  <div class="table-wrapper">
    <table class="posts-table">
      <thead>
        <tr>
          <th>📅 Data</th>
          <th>🧠 Título</th>
          <th class="col-link">🔗 Link</th>
        </tr>
      </thead>
      <tbody>
        {% for post in site.posts %}
        <tr>
          <td data-label="Data">{{ post.date | date: "%d/%m/%Y" }}</td>
          <td data-label="Título">{{ post.title }}</td>
          <td data-label="Link" class="col-link"><a href="{{ post.url }}">Ler mais →</a></td>
        </tr>
        {% endfor %}
      </tbody>
    </table>
  </div>
</section>

<section class="container blog-social">
  <h2>🔗 Social</h2>
  <ul>
    <li><strong>GitHub:</strong> <a href="https://github.com/adelmonsouza">@adelmonsouza</a></li>
    <li><strong>LinkedIn:</strong> <a href="https://www.linkedin.com/in/adelmonsouza/">Perfil Profissional</a></li>
  </ul>
</section>

<section class="container blog-philosophy">
  <h2>🧩 Filosofia</h2>
  <blockquote>
    “Build systems that teach you as much as they serve you.” — The Java Place · v25 Edition
  </blockquote>
  <p>Inspirado no estilo editorial do Adoptium/OpenJDK 25, o foco é clareza visual, nomenclatura padrão e hierarquia modular — a mesma filosofia que guia a engenharia moderna no GitHub e nos portais de Java.</p>
</section>

<section class="container blog-structure">
  <h2>🧠 Estrutura GitHub recomendada</h2>
  <pre><code>📦 the-java-place/
 ┣ 📜 index.md                # Hero + intro + navigation
 ┣ 📜 blog.md                 # Lista de artigos
 ┣ 📜 resources.md            # Hub técnico e playbooks
 ┣ 📜 SECURITY.md             # Regras de segurança e revisão
 ┣ 📜 STATUS_PROJETO.md       # Status e próximos passos
 ┣ 📁 _includes/quick-actions.html
 ┣ 📁 assets/css/custom.css
 ┗ 📁 posts/                  # Conteúdo individual dos artigos
</code></pre>
</section>

<section class="container blog-next">
  <h2>💡 Próximos incrementos sugeridos</h2>
  <ul>
    <li><strong>Banner dinâmico:</strong> exibir Day X/30 do desafio com animação suave (dados centralizados em YAML ou JSON).</li>
    <li><strong>Dark Mode switch:</strong> adicionar modo escuro com Tailwind ou preferências do sistema.</li>
    <li><strong>Adoptium-style footer:</strong> badges “Built with OpenJDK 25 | Spring Boot | GitHub Pages”.</li>
    <li><strong>RSS + sitemap:</strong> habilitar feeds e sitemap automático para SEO técnico.</li>
  </ul>
</section>

<section class="container blog-footer-cta">
  <p>Pronto para construir sistemas que evoluem com você? Explore os recursos, leia os deep dives e acompanhe o #30DiasJava.</p>
  <a class="btn-primary" href="/resources/">Ir para o Resources Hub →</a>
</section>

