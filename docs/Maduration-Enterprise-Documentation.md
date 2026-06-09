
# Maduration Enterprise Documentation

## Executive Summary
Maduration is a Next.js 16 platform for biological maturation analysis, Bio-Banding, athlete management, performance monitoring, and youth football academy operations. The application combines anthropometric assessments, maturity calculations, athlete lifecycle management, analytics, and future collaboration/research capabilities.

---

# 1. Product Vision

Maduration aims to provide practitioners with a biologically informed decision-support platform that goes beyond chronological age.

Core pillars:

- Club Operations
- Athlete Development
- Biological Maturation
- Bio-Banding
- Performance Analytics
- Research & Knowledge Sharing

---

# 2. Functional Documentation

## User Roles

### Club Administrator
- Manage clubs
- Manage teams
- Manage athlete structure
- Configure tests and settings

### Coach
- Manage athletes
- Review analytics
- Track performance

### Sport Scientist
- Register anthropometric data
- Monitor maturation
- Execute Bio-Banding workflows

### Researcher
- Export data
- Analyze datasets
- Conduct comparative studies

---

## Functional Modules

### Hub
Entry point after login.

Capabilities:
- Global navigation
- Module summaries
- User context

### DataHub

#### Club
- Team management
- Athlete management
- Club configuration
- Test battery management

#### Maturation
- Anthropometric collection
- Excel import/export
- Validation
- Maturation calculations

#### Performance
- Performance tests
- Historical tracking
- Training load monitoring

### Analysis

Capabilities:
- Individual dashboards
- Team dashboards
- Bio-Banding analysis
- Alerts
- Comparative reports
- Growth trajectories

### Community (Planned)
- Club collaboration
- Best-practice sharing

### Research (Planned)
- Research collaboration
- Dataset generation

---

# 3. Business Processes

## Athlete Registration
1. Create club
2. Create team
3. Register athlete
4. Assign athlete to team
5. Save profile

## Anthropometric Assessment
1. Select athlete
2. Capture measurements
3. Validate inputs
4. Calculate maturity indicators
5. Store results

## Bio-Banding
1. Calculate maturity status
2. Classify athlete
3. Generate groups
4. Compare biological cohorts

---

# 4. Architecture

## High-Level Architecture

Browser
-> Next.js 16 + React 19
-> Domain Logic Layer
-> Persistence Layer
-> localStorage (current)
-> Supabase/PostgreSQL (target)

## Layered Design

### Presentation Layer
src/app
src/components

Responsibilities:
- UI
- Forms
- Dashboards
- Charts

### Domain Layer
src/lib

Responsibilities:
- Business rules
- Maturation calculations
- Validation
- Data transformation

### Persistence Layer

Current:
- localStorage

Future:
- Supabase

---

# 5. Technology Stack

Frontend:
- Next.js 16.2.2
- React 19.2.4
- TypeScript 5

Styling:
- Tailwind CSS 4

Validation:
- Zod

Charts:
- Recharts

Data Processing:
- XLSX
- ExcelJS

Backend:
- Supabase

Database:
- PostgreSQL

---

# 6. Repository Structure

src/
├── app/
├── components/
├── lib/
├── hooks/
├── public/
├── docs/
└── supabase/

---

# 7. Maturation Engine

Location:
src/lib/maturation

Implemented Models:
- Mirwald
- Moore
- Fransen
- Khamis-Roche

Generated Indicators:
- Maturity Offset
- APHV
- Predicted Adult Height
- Adult Height Percentage
- Bio-Banding Status

Classifications:
- Pre-PHV
- Mid-PHV
- Post-PHV

---

# 8. Database Documentation

## clubs
- id
- name
- region
- sport
- accent_color
- badge_url

## teams
- id
- club_id
- name
- age_group
- photo_url

## athletes
- id
- club_id
- team_id
- name
- sex
- age_group
- position
- category
- dob

## anthropometric_records
- athlete_id
- collected_at
- stature_cm
- body_mass_kg
- sitting_height_cm
- mother_height_cm
- father_height_cm

## performance_entries
- athlete_id
- area
- test_name
- value
- measurement_date

## club_members
- user_id
- club_id
- role

## user_preferences
- user_id
- locale

---

# 9. Entity Relationships

Club
 ├── Teams
 ├── Athletes
 └── Club Members

Team
 └── Athletes

Athlete
 ├── Anthropometric Records
 └── Performance Entries

---

# 10. Security

Authentication:
- Supabase Auth ready

Authorization:
- Club isolation
- Role-based access

Roles:
- owner
- coach
- analyst

Data Protection:
- Row Level Security (RLS)

---

# 11. Deployment

## Requirements

- Node.js 20+
- npm

## Environment Variables

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_DEMO_EMAIL
NEXT_PUBLIC_DEMO_PASSWORD

## Development

npm install
npm run dev

## Production

npm run build
npm run start

---

# 12. Testing

Current Test Entry:

src/lib/maturation/calculations.test.ts

Commands:

npm test
npm run lint

Recommended Coverage:
- Unit tests
- Integration tests
- End-to-End tests

---

# 13. Contribution Guide

Branch Naming:

feature/*
fix/*
docs/*
refactor/*

Commit Convention:

feat:
fix:
docs:
refactor:
test:
chore:

Workflow:
1. Create branch
2. Implement change
3. Run tests
4. Create PR
5. Review
6. Merge

---

# 14. Architectural Decision Records

ADR-001
Use Next.js as primary frontend framework.

ADR-002
Use TypeScript strict mode.

ADR-003
Use Supabase as backend platform.

ADR-004
Separate maturation calculations into dedicated domain layer.

ADR-005
Adopt Bio-Banding classifications as first-class domain concepts.

---

# 15. Roadmap

Short Term:
- Complete Supabase integration
- Improve validation
- Increase test coverage

Medium Term:
- Multi-user collaboration
- Advanced permissions
- Audit logs

Long Term:
- Community module
- Research module
- GPS integrations
- Predictive analytics
- Machine learning insights

---

# 16. Maintenance Notes

Critical Files:
- README.md
- docs/product-overview.md
- docs/roadmap.md
- src/lib/store/app-state.tsx
- src/lib/maturation/*
- supabase/schema.sql

This document was generated from repository structure, README, product overview, package configuration and Supabase schema.
