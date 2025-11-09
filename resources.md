---
layout: default
title: Resources Hub
permalink: /resources/
---

<section class="resources-hero">
  <h1>Resources Hub</h1>
  <p>Cheatsheets, playbooks, and quick references for the #30DiasJava projects. Copy the snippets, run the scripts, and ship production-ready services faster.</p>
</section>

<div class="resources-grid long">
  <article id="dto-security" class="resource-card">
    <h2>DTO Security Cheatsheet</h2>
    <p>Prevent mass assignment, guard internal fields, and keep controllers thin.</p>
    <ul>
      <li>DTO validation vs entity persistence rules</li>
      <li>Mapper guardrails and read-only projections</li>
      <li>Tests for unauthorized field manipulation</li>
    </ul>
    <div class="resource-links">
      <a href="/blog/2025/11/01/dtos-under-the-hood.html">Read deep dive</a>
      <a href="https://github.com/adelmonsouza/30DiasJava-Day01-UserProfileService">View repo</a>
    </div>
  </article>

  <article id="pagination" class="resource-card">
    <h2>Pagination & Memory Guardrails</h2>
    <p>Keep your APIs responsive by limiting data windows and monitoring for double queries.</p>
    <ul>
      <li>Pageable controller templates</li>
      <li>Cursor vs offset comparison</li>
      <li>Observability metrics for pagination</li>
    </ul>
    <div class="resource-links">
      <a href="/blog/2025/11/02/pagination-under-the-hood.html">Performance article</a>
      <a href="https://github.com/adelmonsouza/30DiasJava-Day02-ContentCatalog">Repository</a>
    </div>
  </article>

  <article id="resilience4j" class="resource-card">
    <h2>Resilience4j Playbook</h2>
    <p>Copy-ready circuit breaker, bulkhead, and metrics configuration for resilient APIs.</p>
    <ul>
      <li>Spring Boot annotations + Registry config</li>
      <li>Fallback design checklist</li>
      <li>Micrometer metrics to alert on</li>
    </ul>
    <div class="resource-links">
      <a href="/blog/2025/11/06/resilience4j-under-the-hood.html">Under the hood</a>
      <a href="https://github.com/adelmonsouza/30DiasJava-Day06-Resilience4j">Repository</a>
    </div>
  </article>

  <article id="config-server" class="resource-card">
    <h2>Spring Cloud Config Guide</h2>
    <p>Centralize configuration with Git-backed repos, refresh scope, and secret hygiene.</p>
    <ul>
      <li>Config server bootstrap checklist</li>
      <li>@RefreshScope safe usage rules</li>
      <li>Docker secrets + TLS pointers</li>
    </ul>
    <div class="resource-links">
      <a href="/blog/2025/11/07/config-server-under-the-hood.html">Architecture notes</a>
      <a href="https://github.com/adelmonsouza/30DiasJava-Day07-ConfigService">Repository</a>
    </div>
  </article>

  <article id="observability" class="resource-card">
    <h2>Observability & Alerting Toolkit</h2>
    <p>Prometheus rules, Alertmanager routing, and Grafana panel queries ready to paste.</p>
    <ul>
      <li>p95 latency alert template</li>
      <li>Domain KPI counter examples</li>
      <li>Dashboard notes for Day 08</li>
    </ul>
    <div class="resource-links">
      <a href="/blog/2025/11/08/observability-under-the-hood.html">Article</a>
      <a href="https://github.com/adelmonsouza/30DiasJava-Day08-Observability">Repository</a>
    </div>
  </article>

  <article id="pre-golive" class="resource-card">
    <h2>pre-golive Validation Checklist</h2>
    <p>Automated checks before every deploy: secrets, tests, coverage, and dependency scans.</p>
    <ul>
      <li>Run `./pre-golive.sh project-name --no-cache`</li>
      <li>Integrate with pre-push hook & GitHub Actions</li>
      <li>Extend with security scanners and custom rules</li>
    </ul>
    <div class="resource-links">
      <a href="https://github.com/adelmonsouza/30DiasJava/blob/main/pre-golive.sh">Open script</a>
      <a href="https://github.com/adelmonsouza/30DiasJava/blob/main/scripts/PRE_GOLIVE_GUIDE.md">Read guide</a>
    </div>
  </article>
</div>
