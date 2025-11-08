// Table of Contents Generator - SwiftyPlace style
(function() {
    'use strict';
    
    function generateTOC() {
        const articleContent = document.querySelector('.article-content');
        const tocNav = document.getElementById('toc');
        
        if (!articleContent || !tocNav) return;
        
        const headings = articleContent.querySelectorAll('h2, h3, h4');
        if (headings.length === 0) {
            tocNav.innerHTML = '<p style="color: var(--text-light); font-size: 0.875rem;">No sections available</p>';
            return;
        }
        
        let tocHTML = '<ul>';
        let currentLevel = 2; // Start with h2
        let tocIndex = 1;
        
        headings.forEach((heading, index) => {
            const level = parseInt(heading.tagName.substring(1));
            const id = heading.id || `heading-${index}`;
            
            // Create ID if doesn't exist
            if (!heading.id) {
                heading.id = id;
            }
            
            const text = heading.textContent.trim();
            
            // Close previous level if needed
            if (level > currentLevel) {
                tocHTML += '<ul>';
            } else if (level < currentLevel) {
                const diff = currentLevel - level;
                for (let i = 0; i < diff; i++) {
                    tocHTML += '</ul>';
                }
            }
            
            // Add TOC item
            tocHTML += `<li><a href="#${id}" data-level="${level}">${tocIndex}. ${text}</a></li>`;
            
            if (level === 2) {
                tocIndex++;
            }
            
            currentLevel = level;
        });
        
        // Close remaining lists
        while (currentLevel > 2) {
            tocHTML += '</ul>';
            currentLevel--;
        }
        
        tocHTML += '</ul>';
        tocNav.innerHTML = tocHTML;
        
        // Add click handlers
        const tocLinks = tocNav.querySelectorAll('a');
        tocLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const targetId = this.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    const headerOffset = 100;
                    const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                    
                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                    
                    // Update active state
                    updateActiveTOCItem(targetId);
                }
            });
        });
        
        // Highlight active section on scroll
        const observerOptions = {
            root: null,
            rootMargin: '-100px 0px -66% 0px',
            threshold: 0
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    updateActiveTOCItem(entry.target.id);
                }
            });
        }, observerOptions);
        
        headings.forEach(heading => {
            observer.observe(heading);
        });
    }
    
    function updateActiveTOCItem(activeId) {
        const tocLinks = document.querySelectorAll('#toc a');
        tocLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${activeId}`) {
                link.classList.add('active');
            }
        });
    }
    
    // Toggle mobile TOC
    const tocToggle = document.querySelector('.toc-toggle');
    if (tocToggle) {
        tocToggle.addEventListener('click', function() {
            const tocNav = document.getElementById('toc');
            if (tocNav) {
                tocNav.classList.toggle('active');
            }
        });
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', generateTOC);
    } else {
        generateTOC();
    }
})();

