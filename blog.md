---
layout: default
title: Blog
permalink: /blog/
---

# Blog - The Java Place

Artigos técnicos e deep-dives sobre Java, Spring Boot e Arquitetura de Software.

---

## Posts

<ul>
  {% for post in site.posts %}
    <li>
      <a href="{{ post.url }}">{{ post.title }}</a>
      <span style="color: #666;"> - {{ post.date | date: "%d/%m/%Y" }}</span>
    </li>
  {% endfor %}
</ul>

---

[← Voltar para Home](/)

