# Portfolio Site

My personal portfolio website built with Jekyll and the Chirpy theme. Visit at [santtu.fyi](https://santtu.fyi/).

## Features

- Responsive design optimized for desktop and mobile browsing
- Project showcase with detailed descriptions and images
- Blog section with technical articles and project updates
- Dark/light mode toggle
- Clean, minimalist design focused on readability
- Fast loading times and optimized performance

## Technologies

- **Framework**: Jekyll static site generator
- **Theme**: [Chirpy](https://github.com/cotes2020/jekyll-theme-chirpy) with custom modifications
- **Hosting**: GitHub Pages with custom domain
- **Languages**: HTML, CSS, JavaScript, Markdown
- **Build Tools**: Ruby, Bundler

## Site Structure

- `_posts/` - Blog posts and project descriptions
- `_tabs/` - Main navigation pages (About, Categories, Tags, Archives)
- `assets/` - Images, JavaScript, and CSS files
- `_config.yml` - Site configuration
- `_layouts/` and `_includes/` - Templates and reusable components

## Local Development

1. Install Ruby and Bundler:
   ```bash
   # On Windows with Chocolatey
   choco install ruby
   gem install bundler
   ```

2. Clone the repository:
   ```bash
   git clone https://github.com/cyanidesayonara/portfolio-site.git
   cd portfolio-site
   ```

3. Install dependencies:
   ```bash
   bundle install
   ```

4. Start the local server with live reload:
   ```bash
   bundle exec jekyll serve --livereload
   ```

5. Visit `http://localhost:4000/` in your browser

## Adding Content

### New Blog Post

Create a new Markdown file in the `_posts` directory with the format `YYYY-MM-DD-title.md`:

```markdown
---
title: "Your Post Title"
date: YYYY-MM-DD
categories: [Category]
tags: [tag1, tag2]
image:
  path: /assets/img/posts/image-name.png
  alt: Description of the image
---

Your content here...
```

## Deployment

The site is automatically deployed to GitHub Pages when changes are pushed to the main branch.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
