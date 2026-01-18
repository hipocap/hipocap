# UI Layout Structure

## Overview
This document outlines the complete UI layout structure of the Hipocap Shield application built with Next.js 13+ App Router.

---

## 1. Root Layout (`app/layout.tsx`)

The root layout wraps the entire application and provides global structure.

```
<html>
  └── <body>
      ├── PostHogPageView (Analytics)
      └── <div className="flex">
          └── <div className="flex flex-col grow max-w-full min-h-screen">
              ├── <main> (Page Content)
              └── <Toaster> (Toast Notifications)
```

**Key Features:**
- Global CSS imports (`globals.css`, `scroll.css`)
- Font configuration (Manrope, Sans)
- PostHog analytics integration
- Toast notification system
- Full-height flex layout

---

## 2. Project Layout (`app/project/[projectId]/layout.tsx`)

The project-specific layout provides the main application interface with sidebar navigation.

```
<UserContextProvider>
  └── <SessionSyncProvider>
      └── <PostHogIdentifier>
          └── <ProjectContextProvider>
              └── <div className="fixed inset-0 flex overflow-hidden">
                  └── <SidebarProvider>
                      ├── <ProjectSidebar> (Left Sidebar)
                      └── <SidebarInset> (Main Content Area)
                          ├── <ProjectUsageBanner> (Conditional)
                          └── {children} (Page Content)
```

**Components:**

### 2.1 ProjectSidebar Structure
```
<Sidebar>
  ├── <ProjectSidebarHeader>
  │   └── Project Selector Dropdown
  │       ├── Current Project Name
  │       ├── Projects List
  │       ├── Workspace Link
  │       └── Logout Button
  │
  ├── <ProjectSidebarContent>
  │   └── Navigation Categories:
  │       ├── Monitoring
  │       │   ├── Dashboards
  │       │   └── Traces
  │       │
  │       ├── Development
  │       │   ├── Playgrounds
  │       │   └── SQL Editor
  │       │
  │       ├── Data Management
  │       │   ├── Datasets
  │       │   ├── Labeling
  │       │   └── Evaluators
  │       │
  │       └── Configuration
  │           ├── Policies
  │           └── Settings
  │
  └── <SidebarFooter>
      └── Usage Display (Free Tier)
```

### 2.2 SidebarInset (Main Content Area)
```
<SidebarInset>
  ├── <ProjectUsageBanner> (if usage > 80%)
  └── {children} (Page-specific content)
      └── Typically includes:
          ├── <Header> (Breadcrumb navigation)
          └── Page Content
```

---

## 3. Workspace Layout (`app/workspace/[workspaceId]/layout.tsx`)

Simpler layout for workspace-level pages.

```
<UserContextProvider>
  └── <SessionSyncProvider>
      └── {children}
```

**Note:** Workspace pages may have their own sidebar structure similar to project pages.

---

## 4. Header Component (`components/ui/header.tsx`)

Used within pages for breadcrumb navigation.

```
<Header>
  ├── <SidebarTrigger> (Toggle sidebar)
  └── Breadcrumb Segments
      └── Path segments as clickable links
```

**Features:**
- Breadcrumb navigation
- Sidebar toggle button
- Customizable path segments
- Optional children for additional actions

---

## 5. Layout Hierarchy

```
Root Layout (app/layout.tsx)
│
├── Public Pages (/, /sign-in, /sign-up, etc.)
│   └── Simple layout with no sidebar
│
├── Project Pages (/project/[projectId]/...)
│   └── Project Layout
│       ├── Sidebar (Collapsible)
│       │   ├── Header (Project selector)
│       │   ├── Navigation Menu
│       │   └── Footer (Usage display)
│       │
│       └── Main Content Area
│           ├── Header (Breadcrumbs)
│           └── Page Content
│
└── Workspace Pages (/workspace/[workspaceId]/...)
    └── Workspace Layout
        └── Workspace-specific content
```

---

## 6. Context Providers

The application uses several context providers for state management:

1. **UserContextProvider** - User authentication and profile data
2. **ProjectContextProvider** - Current project, workspace, and projects list
3. **SessionSyncProvider** - Session synchronization across tabs
4. **SidebarProvider** - Sidebar state (open/closed, mobile/desktop)

---

## 7. Navigation Structure

### Project Navigation Menu Categories:

1. **Monitoring**
   - `/project/[projectId]/dashboard` - Dashboards
   - `/project/[projectId]/traces` - Traces

2. **Development**
   - `/project/[projectId]/playgrounds` - Playgrounds
   - `/project/[projectId]/sql` - SQL Editor

3. **Data Management**
   - `/project/[projectId]/datasets` - Datasets
   - `/project/[projectId]/labeling-queues` - Labeling Queues
   - `/project/[projectId]/evaluators` - Evaluators

4. **Configuration**
   - `/project/[projectId]/policies` - Policies
   - `/project/[projectId]/settings` - Settings

---

## 8. Styling & Design System

- **Framework:** Tailwind CSS
- **UI Components:** Radix UI primitives
- **Icons:** Lucide React
- **Animations:** Framer Motion
- **Sidebar:** Custom sidebar component with collapsible functionality
- **Theme:** Supports light/dark mode (via CSS variables)

---

## 9. Key UI Patterns

### 9.1 Sidebar Pattern
- Collapsible sidebar (icon-only when collapsed)
- Mobile-responsive (drawer on mobile)
- State persisted in cookies
- Smooth animations

### 9.2 Header Pattern
- Breadcrumb navigation
- Sidebar toggle
- Customizable with children prop

### 9.3 Content Area Pattern
- Full-height flex layout
- Scrollable content
- Rounded corners on desktop
- Border styling

---

## 10. Responsive Behavior

- **Desktop:** Sidebar visible, collapsible to icon-only
- **Mobile:** Sidebar as drawer, overlay on content
- **Tablet:** Similar to desktop with adjusted spacing

---

## 11. File Structure Reference

```
app/
├── layout.tsx                    # Root layout
├── project/
│   └── [projectId]/
│       ├── layout.tsx            # Project layout
│       └── [page]/               # Project pages
├── workspace/
│   └── [workspaceId]/
│       ├── layout.tsx            # Workspace layout
│       └── page.tsx              # Workspace page

components/
├── ui/
│   ├── header.tsx                # Header component
│   ├── sidebar.tsx               # Sidebar primitives
│   └── toaster.tsx               # Toast notifications
├── project/
│   └── sidebar/
│       ├── index.tsx             # Project sidebar
│       ├── header.tsx            # Sidebar header
│       └── content.tsx           # Sidebar navigation
└── workspace/
    └── sidebar/                  # Workspace sidebar (similar structure)
```

---

## 12. State Management

- **Server Components:** Layouts fetch data server-side
- **Client Components:** Interactive UI elements (sidebar, dropdowns)
- **Context API:** Global state (user, project, workspace)
- **Cookies:** Sidebar state persistence

---

This structure provides a scalable, maintainable layout system that supports both project-level and workspace-level navigation with consistent UI patterns throughout the application.
