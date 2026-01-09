---
aliases:
  - "Zettelkasten knowledge management system"
  - "How to use Zettelkasten for knowledge management"
  - "Zettelkasten workflow and structure"
  - "Atomic note taking system"
tags:
  - project-cm2
  - project-agi
  - project-shared
  - concept-zettelkasten
  - concept-knowledge-management
  - status-active
  - type-howto
source: "Original document created by Orion"
source_date: "2026-01-06"
created: "2026-01-06"
updated: "2026-01-07"
---

# Zettelkasten Knowledge Base: How-To Guide

## Core Idea

A comprehensive system for managing knowledge across projects using Zettelkasten principles with Obsidian integration, emphasizing atomic notes, structured frontmatter, and cross-project linking.

## Key Points

### Directory Structure
- **00-INBOX/**: Unprocessed notes awaiting organization
- **ZETTEL/**: Atomic notes following Zettelkasten principles
- **DOCS/**: Processed historical documents and source materials
- Central `.Docs/` folder serves as knowledge base referencing files from any project

### Naming Conventions
- **Historical files**: `YYYYMMDD-idea-slug.md` (date idea first appeared)
- **New files**: `YYYYMMDDHHMM-slug.md` (date/time of creation)
- **Source documents**: Keep original filenames in `DOCS/` folder

### Required Frontmatter Properties
```yaml
aliases: 3-5 alternative names for discoverability
tags: Categorization using defined taxonomy
source: Original document reference (for extracted notes)
source_date: When original was created
created: When note was created
updated: Last modification date
```

### Tag Taxonomy System
- **Project tags**: `project-cm2`, `project-agi`, `project-shared`
- **Concept tags**: `concept-pcc`, `concept-red`, `concept-cap`, etc.
- **Status tags**: `status-active`, `status-reviewed`, `status-archived`
- **Type tags**: `type-idea`, `type-problem`, `type-solution`, `type-howto`
- **Domain tags**: `domain-backend`, `domain-frontend`, `domain-database`

### Workflow Process
1. **Capture**: New ideas to `ZETTEL/`, existing documents to `00-INBOX/`
2. **Process**: Extract atomic ideas, add frontmatter, create links
3. **Review**: Daily check of unlinked mentions, weekly graph review
4. **Maintain**: Update notes, add aliases, merge/archive as needed

### Note Size Guidelines
- Optimal: 200-400 words per atomic note
- Do not split unique ideas over 400 words into multiple files
- Combine related ideas if less than 200 words

### Linking Strategy
- **Explicit links**: `[[note-id]]` syntax for direct connections
- **Implicit links**: Obsidian detects aliases for unlinked mentions
- **INDEX files**: Navigation files for major topics
- **Backlinks**: Shows what links to current note

### Multi-Project Management
- Single Obsidian vault at `AGI/.Docs/`
- Cross-project references using `project-*` tags
- Shared concepts in `SHARED/` folder
- Project-specific views via tag filtering

### Automation & Tools
- Date extraction from git history
- Template system for consistent note creation
- Obsidian plugins: Templater, Dataview, Various Complements
- Quality checklist before marking as `status-reviewed`

## Critical Review

### Strengths
- Systematic approach to knowledge management
- Clear separation of source documents and atomic notes
- Cross-project compatibility
- Discoverability through aliases and tags
- Scalable structure for growing knowledge base

### Limitations
- Requires discipline to maintain atomic principle
- Initial setup overhead for existing documents
- Need for regular review and maintenance
- Potential for information fragmentation if not properly linked

### Assumptions
- Obsidian as primary tool (though system is tool-agnostic)
- Team adherence to naming and tagging conventions
- Regular review cycles to maintain system health
- Value of atomic notes over lengthy documentation

## Connections

### Builds On
- Traditional Zettelkasten methodology by Niklas Luhmann
- Digital garden concepts for personal knowledge management
- Modern note-taking systems like Roam Research and Obsidian

### Enables
- Efficient knowledge retrieval across projects
- Discovery of unexpected connections between ideas
- Long-term knowledge accumulation and compounding
- Cross-project knowledge sharing and reuse

### Related
- [[202601061729-zettel-note-content-guidelines]] - Content standards for Zettel notes
- Knowledge graph construction and maintenance
- Information architecture principles
- Personal knowledge management systems

## Action Items

- [ ] Process existing files in `00-INBOX/` following this guide
- [ ] Create template for new notes with all required frontmatter
- [ ] Set up Obsidian plugins: Templater, Dataview, Various Complements
- [ ] Establish daily review routine for unlinked mentions
- [ ] Create INDEX files for major topics (PCC, RED, CAP, etc.)
- [ ] Train team members on Zettelkasten workflow and conventions

## References

- Original document created by Orion on 2026-01-06
- Zettelkasten methodology: Niklas Luhmann's note-taking system
- Obsidian documentation for plugin setup and usage
- Knowledge management best practices for software projects
