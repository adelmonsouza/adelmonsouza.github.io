---
layout: default
title: The Java Place
---

{% assign total_days = site.challenge.total_days | default: 30 %}
{% assign current_day = site.challenge.current_day | default: 1 %}
{% assign progress = current_day | times: 100 %}
{% assign progress = progress | divided_by: total_days %}
{% assign latest_project_name = site.challenge.latest_project.name | default: "Observability Stack" %}
{% assign latest_project_url = site.challenge.latest_project.url | default: "https://github.com/adelmonsouza/30DiasJava-Day08-Observability" %}
{% assign progress_display = progress | round %}

<section class="home-hero">
  <div class="home-hero-inner">
    <p class="hero-badge">#30DiasJava Challenge</p>
    <h1 class="hero-title">Day {{ current_day }} of {{ total_days }}</h1>
    <p class="hero-subtitle">Deep dives that turn Spring Boot projects into production-grade systems. Real architecture, testing, CI/CD, observability — delivered daily.</p>
    <div class="hero-progress">
      <div class="hero-progress-bar" style="width: {{ progress }}%"></div>
    </div>
    <div class="hero-progress-meta">
      <span>{{ progress_display }}% complete</span>
      <span>Latest project: <a href="{{ latest_project_url }}">Day {{ current_day }} · {{ latest_project_name }}</a></span>
    </div>
    <div class="hero-cta">
      <a class="btn-primary" href="/blog/">Read Today’s Deep Dive →</a>
      <a class="btn-secondary" href="https://github.com/adelmonsouza/30DiasJava">Explore the Code on GitHub</a>
    </div>
  </div>
</section>

<div class="home-layout">
  <aside class="home-sidebar">
    {% include quick-actions.html %}

    <div class="persona-cards">
      <h3 class="persona-title">Choose Your Path</h3>
      <div class="persona-card">
        <h4>Backend Engineer</h4>
        <p>Looking for clean DTOs, pagination, and resilient APIs? Start with Day 01–03 articles.</p>
        <a href="/blog/2025/11/01/dtos-under-the-hood.html">Boost controller design →</a>
      </div>
      <div class="persona-card">
        <h4>DevOps Engineer</h4>
        <p>Need production checks and automation? Review the <code>pre-golive.sh</code> playbook and Day 08 observability stack.</p>
        <a href="https://github.com/adelmonsouza/30DiasJava/blob/main/pre-golive.sh">Open the script →</a>
      </div>
      <div class="persona-card">
        <h4>Tech Lead</h4>
        <p>Want architecture trade-offs and business context? Read the Business Plans and deep dives for each project.</p>
        <a href="/resources/">View resource hub →</a>
      </div>
    </div>
  </aside>

  <main class="home-main">
    <section class="home-section">
      <h2>Welcome to The Java Place</h2>
      <p>The Java Place is the go-to website for everything Java and Spring Boot development. Every article breaks down the architectural decisions, testing strategies, and DevOps tooling that keep enterprise systems healthy in production.</p>
      <p>Whether you are just starting out or leading a microservices migration, you will find detailed walkthroughs, diagrams, and scripts you can apply immediately.</p>
    </section>

    <section class="home-section">
      <h2>What You'll Find Here</h2>
      <div class="features-grid">
        <article>
          <h3>📚 Technical Deep Dives</h3>
          <ul>
            <li>How DTOs prevent mass assignment attacks</li>
            <li>Why pagination protects JVM memory</li>
            <li>Collaborative filtering with Jaccard similarity</li>
            <li>Event-driven architecture with resilient messaging</li>
          </ul>
        </article>
        <article>
          <h3>🏗️ Architecture & Design</h3>
          <ul>
            <li>Thin controllers, fat services, and API contracts</li>
            <li>Microservice communication strategies</li>
            <li>Performance audits with concrete metrics</li>
            <li>Structured testing strategies (JUnit + Testcontainers)</li>
          </ul>
        </article>
        <article>
          <h3>🛠️ Automation & Ops</h3>
          <ul>
            <li>Docker and Compose for reproducible environments</li>
            <li>GitHub Actions pipelines with coverage gates</li>
            <li>pre-golive validation across all services</li>
            <li>Observability dashboards and alerting rules</li>
          </ul>
        </article>
      </div>
    </section>

    <section class="home-section">
      <h2>The #30DiasJava Roadmap</h2>
      <p>Starting on November 1, 2025, one new Java/Spring Boot project ships every day. Each project includes production-ready code, automated tests, CI/CD, Docker, business context, and a deep-dive explaining the decisions under the hood.</p>
      <ul class="roadmap-list">
        <li><strong>Day 1:</strong> User-Profile-Service — DTOs, JWT, Spring Security</li>
        <li><strong>Day 2:</strong> Content-Catalog-API — Efficient pagination and performance audits</li>
        <li><strong>Day 3:</strong> Recommendation-Engine — Collaborative filtering with JPA + data structures</li>
        <li><strong>Day 6:</strong> Resilience4j Playground — Circuit breakers, bulkheads, time limiter</li>
        <li><strong>Day 7:</strong> Config Service — Spring Cloud Config, @RefreshScope, Docker secrets</li>
        <li><strong>Day 8:</strong> Observability Stack — Prometheus, Alertmanager, Grafana dashboards</li>
        <li><strong>…and 22 more production-themed projects.</strong></li>
      </ul>
      <a class="btn-text" href="https://github.com/adelmonsouza/30DiasJava">Follow the challenge on GitHub →</a>
    </section>

    <section class="home-section">
      <h2>Resources Hub Preview</h2>
      <div class="resources-preview">
        <article class="resource-card">
          <h3>DTO Security Cheatsheet</h3>
          <p>Audit requests, prevent mass assignment, and lock down your API contracts.</p>
          <div class="resource-links">
            <a href="/blog/2025/11/01/dtos-under-the-hood.html">Read deep dive</a>
            <a href="/resources/#dto-security">View cheatsheet</a>
          </div>
        </article>
        <article class="resource-card">
          <h3>Resilience Playbook</h3>
          <p>Resilience4j circuit breaker, bulkhead, and metrics templates ready to copy.</p>
          <div class="resource-links">
            <a href="/blog/2025/11/06/resilience4j-under-the-hood.html">Explore article</a>
            <a href="/resources/#resilience4j">Open playbook</a>
          </div>
        </article>
        <article class="resource-card">
          <h3>Observability & Alerts</h3>
          <p>Prometheus rules, Alertmanager routing, and Grafana panel queries for Day 08.</p>
          <div class="resource-links">
            <a href="/blog/2025/11/08/observability-under-the-hood.html">Inspect setup</a>
            <a href="/resources/#observability">Go to dashboard tips</a>
          </div>
        </article>
      </div>
      <a class="btn-secondary" href="/resources/">Browse the full Resources Hub</a>
    </section>

    <section class="home-section">
      <h2>Latest Articles</h2>
      <div class="articles-grid">
        <article class="article-card">
          <h3><a href="/blog/2025/11/02/pagination-under-the-hood.html">Efficient Pagination in Spring Boot: How Design Decisions Prevent OutOfMemoryError</a></h3>
          <p class="article-meta">November 2, 2025 · Performance, Spring Boot</p>
          <p class="article-excerpt">Understand what really happens when you load millions of records into memory and how `Pageable` keeps your JVM stable.</p>
          <a href="/blog/2025/11/02/pagination-under-the-hood.html" class="article-link">Read more →</a>
        </article>
        <article class="article-card">
          <h3><a href="/blog/2025/11/01/dtos-under-the-hood.html">DTOs, Entities, and Thin Controllers: How Architectural Decisions Impact Security and Performance</a></h3>
          <p class="article-meta">November 1, 2025 · Architecture, Spring Boot</p>
          <p class="article-excerpt">Learn how separating entities and DTOs guards your application from mass assignment and keeps responses optimized.</p>
          <a href="/blog/2025/11/01/dtos-under-the-hood.html" class="article-link">Read more →</a>
        </article>
      </div>
      <p class="centered">
        <a href="/blog/" class="btn-primary">View All Articles →</a>
      </p>
    </section>

    <section class="home-section">
      <h2>Connect With Me</h2>
      <p>Stay ahead of the curve and get notified as soon as a new project ships.</p>
      <ul class="connect-list">
        <li><strong>GitHub:</strong> <a href="https://github.com/adelmonsouza">@adelmonsouza</a> — track the repositories and follow the challenge.</li>
        <li><strong>LinkedIn:</strong> <a href="https://www.linkedin.com/in/adelmonsouza/">adelmonsouza</a> — professional updates, lessons learned, and open discussions.</li>
        <li><strong>Blog:</strong> <a href="https://enouveau.io">The Java Place</a> — all deep dives, cheatsheets, and playbooks.</li>
      </ul>
    </section>
  </main>
</div>

<section class="home-section last-section">
  <h2>Let’s Build Production-Grade Java Apps</h2>
  <p>Ship features quickly without sacrificing reliability. Use the resources, scripts, and templates here to raise the quality bar for every service you deploy.</p>
  <a class="btn-primary" href="/resources/">Start with the Resources Hub →</a>
</section>

