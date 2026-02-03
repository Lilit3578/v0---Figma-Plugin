Technical Specification: The Semantic Design Compiler
Figma Plugin for AI-Driven Rule-Based Design Generation
Version: 4.0
 Status: Implementation Ready
 Document Type: Complete Technical Specification
 Last Updated: January 2026
 Document Length: ~35,000 words | 120+ pages
 Estimated Reading Time: 2-3 hours

Document Information
Purpose
This specification provides a complete, implementation-ready architectural blueprint for building the Semantic Design Compiler - a Figma plugin that generates production-ready product layouts by treating design as executable code.
Scope
This document addresses ALL identified gaps from previous versions and provides detailed specifications for every component, service, workflow, and user interaction in the system.
Audience
Product designers (understanding system capabilities)
Engineering teams (implementation guidance)
Product managers (feature planning)
Stakeholders (system overview)
Document Structure
Sections 1-2: Overview and core architecture
Sections 3-6: Core services and data structures
Sections 7-10: Conflict resolution, rules, execution, and export
Sections 11-13: Advanced features (state, responsive, versioning)
Sections 14-17: Operations (performance, approvals, security, roadmap)
Section 18: Complete reference appendices

Table of Contents
Executive Summary
Core Philosophy & Architecture
Data Schema: Recursive Semantic Node Tree (RSNT)
Discovery Service: Fingerprinting & Mapping
Resolution Service: 5-Tier Fallback Hierarchy
Orchestration Service: The AI Brain
Conflict Resolution Logic
Rule Authoring System
Execution & Rendering Engine
Code Export & Semantic Output
State Management & Conditional Rendering
Responsive Design Handling
Version Control & Migration
Performance Specifications
Designer Approval Flows
Security & Privacy
Implementation Roadmap
Appendices

1. Executive Summary
1.1 Purpose
The Semantic Design Compiler is a Figma plugin that generates production-ready product layouts by treating design as a compiled language. It uses Tailwind CSS as its internal grammar, enforces deterministic design rules, and adapts automatically to any client's design system or component library (Shadcn UI, Radix UI, custom libraries).
The Problem It Solves
Current State:
Designers manually create every variation of every component
Design systems are documented but not enforced
Handoff to developers is manual and error-prone
Maintaining consistency across multiple brands is time-consuming
Junior designers struggle to follow senior patterns
With Semantic Design Compiler:
Encode design patterns once, generate infinite variations
Design system rules are automatically enforced
Export production-ready React/Tailwind code from Figma
One rule set works across multiple client design systems
Anyone can generate designs following expert patterns
1.2 Core Innovation
Design as Code Compilation:
The system treats design not as creative output but as the result of executing deterministic rules:
User Intent (Natural Language)
    ↓
AI Lexer (Interpretation)
    ↓
RSNT (Intermediate Representation)
    ↓
Rule Engine (Logic Execution)
    ↓
Figma Renderer (Target Output)
Key Differentiator: The AI never "designs" — it only translates intent into a structured Recursive Semantic Node Tree (RSNT). All actual design decisions are made by deterministic rules that can be versioned, audited, and reproduced exactly.
What Makes This Different
Traditional Design Tools:
Designer manually creates every design
AI tools hallucinate layouts (inconsistent results)
No connection between design and code
Each client requires starting from scratch
Semantic Design Compiler:
Designer defines rules once, generates many designs
AI only interprets intent (deterministic results)
1:1 parity between Figma and React code
Same rules adapt to any client's design system
1.3 System Guarantees
The system provides five core guarantees:
1. Determinism
Guarantee: Identical input always yields identical output
How: Rules are purely functional (no randomness, no side effects)
Why It Matters: Enables reliable version control, reproducible builds, team collaboration
Example: Generate "Login Card" with Shadcn preset on Monday → Generate same request on Friday → Pixel-perfect identical result
2. Scalability
Guarantee: Works with any design system without manual configuration
How: Automatic fingerprinting discovers and maps client components/variables
Why It Matters: No setup time, works in any Figma file immediately
Example: Works equally well with Shadcn UI, Material Design, or custom enterprise design system
3. Fidelity
Guarantee: Reproduces the creator's design logic exactly
How: Rules encode your decision-making patterns as executable logic
Why It Matters: Maintains design quality even when used by non-experts
Example: Junior designer generates design → Matches senior designer's patterns exactly
4. Portability
Guarantee: Generates 1:1 production code matching Figma output
How: Semantic metadata enables deterministic code generation
Why It Matters: Zero implementation errors, faster dev handoff
Example: Button in Figma → Exact same button in React (dimensions, spacing, behavior)
5. Performance
Guarantee: Processes 100+ components in under 5 seconds
How: Intelligent caching, batching, and parallel processing
Why It Matters: Fast enough for interactive design workflows
Example: Generate complex dashboard with 150 elements → 4.2 seconds
1.4 Primary Use Cases
Use Case 1: Consistent Multi-Brand Design
Actor: Design agency serving multiple clients
Scenario: Need to create similar products for different brands
Without Plugin: Manually adapt each design to each brand (100+ hours per client)
With Plugin: Same rules adapt automatically to each client's design system (5 hours per client)
Value: 95% time savings, perfect consistency
Use Case 2: Design System Enforcement
Actor: Design system team at large company
Scenario: 50+ product designers need to follow design system
Without Plugin: Documented guidelines, manual reviews, frequent violations
With Plugin: Rules automatically enforce design system, violations impossible
Value: 100% compliance, reduced review time
Use Case 3: Junior Designer Enablement
Actor: Junior product designer
Scenario: Needs to create professional-quality layouts
Without Plugin: Struggles with spacing, hierarchy, patterns (senior review required)
With Plugin: Generates designs following senior patterns automatically (independent work)
Value: Faster onboarding, reduced mentorship burden
Use Case 4: Design-to-Dev Handoff
Actor: Product team (designer + developer)
Scenario: Need pixel-perfect implementation of designs
Without Plugin: Manual handoff, interpretation errors, back-and-forth
With Plugin: Export React code matching Figma exactly (copy-paste ready)
Value: Zero implementation errors, 70% faster dev time
Use Case 5: Rapid Prototyping
Actor: Product manager or non-designer
Scenario: Need quick mockups for stakeholder presentations
Without Plugin: Request designer time (wait) or create low-quality mockups
With Plugin: Generate professional mockups in natural language (minutes)
Value: Self-service design, faster iteration
1.5 Key Metrics & Targets
Quality Metrics
Design Consistency: 100% (deterministic rules)
Code Export Accuracy: 99% pixel-perfect match to Figma
Rule Fidelity: 95% of designs match creator intent
User Satisfaction: Target 4.5/5 stars
Performance Metrics
Generation Time (Simple): < 500ms for 10 nodes
Generation Time (Medium): < 2s for 50 nodes
Generation Time (Complex): < 5s for 100 nodes
Discovery Time (Cached): < 100ms
Discovery Time (Uncached): < 10s for 200 components
Adoption Metrics
Setup Time: 0 minutes (automatic discovery)
Learning Curve: 15 minutes to first generation
Daily Active Usage: Target 80% of adopters
Designs Generated: Target 1000+ per month per team

2. Core Philosophy & Architecture
2.1 Foundational Philosophy
2.1.1 Design as Executable Logic
The fundamental premise of this system is that design is not subjective creativity but the result of logical decisions that can be codified.
Traditional View:
Design = Creative expression
Designer makes intuitive choices
Each design is unique
Cannot be systematized
Semantic Design Compiler View:
Design = Logic execution
Designer defines rules once
Rules generate infinite variations
Fully systematized
What This Means in Practice:
Every design choice can be expressed as a rule:
"Primary buttons use bg-primary with px-4 py-2 padding"
"Cards have 24px padding on desktop, 16px on mobile"
"Form fields stack vertically with 16px gap between them"
"Error states show red border and error message below"
These rules are not guidelines — they are executable code that the system follows exactly.
2.1.2 Separation of Logic and Presentation
The system maintains strict separation between three concerns:
1. Semantic Meaning (What it is)
Role: "This is a PrimaryButton"
Independent of visual styling
Universal across all design systems
2. Structural Logic (How it's arranged)
Layout: "Horizontal stack with center alignment"
Independent of dimensions or colors
Universal pattern (flex-center-both)
3. Visual Styling (How it looks)
Presentation: "Blue background, white text, rounded corners"
Specific to client's design system
Varies per brand
Why This Matters:
This separation enables one set of rules to work across infinite design systems:
Same semantic role ("PrimaryButton")
Same structural logic (horizontal layout, centered)
Different visual styling (Brand A: blue/rounded, Brand B: purple/squared)
Example:
RSNT (Universal):
- Semantic Role: PrimaryButton
- Layout Primitive: stack-h-center
- Props: { label: "Submit", size: "md" }

Client A (Shadcn):
- Component: Button (Type: Filled, Size: Default)
- Colors: bg-primary (#0ea5e9)
- Height: 40px
- Radius: 6px

Client B (Material):
- Component: Button (Type: Contained, Size: Medium)
- Colors: bg-primary (#1976d2)
- Height: 36px
- Radius: 4px

Same RSNT → Different visual output → Both correct for their brand
2.1.3 AI as Interpreter, Not Creator
Critical Distinction:
AI DOES:
Parse natural language into structured data
Select semantic roles from approved list
Choose layout primitives from standard library
Apply Tailwind classes from reference
Calculate confidence in its interpretation
AI DOES NOT:
Make design decisions
Invent new components
Create arbitrary layouts
Hallucinate styling
Deviate from rules
Enforcement Mechanism:
The AI is constrained by:
Approved Semantic Roles: Can only use pre-defined roles (PrimaryButton, FormField, etc.)
Standardized Layout Primitives: Can only use pre-defined patterns (stack-v, flex-center-both, etc.)
Tailwind Reference: Can only use documented Tailwind classes
Schema Validation: Output must match RSNT schema exactly
If AI attempts to use something outside these constraints, validation fails and designer is notified.
Example of Constraint:
User: "Create a super fancy glowing neon button"

AI Attempts: 
- Semantic Role: "FancyNeonButton" ❌ Not in approved list
- Layout Primitive: "glowing-stack" ❌ Not in approved list
- Tailwind Classes: ["bg-neon-glow"] ❌ Not valid Tailwind

Validation: FAIL
System Response: "I don't have a rule for 'Fancy Neon Button'. Should I use a standard PrimaryButton instead?"
2.2 System Architecture Overview
2.2.1 High-Level Pipeline
The system operates as a sequential pipeline with five primary services:
┌──────────────────────────────────────────────────────────────┐
│                      USER INTENT LAYER                        │
│                                                               │
│  "Create a login card with email and password fields"        │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                  AI ORCHESTRATION SERVICE                     │
│                                                               │
│  Role: Translate intent → RSNT structure                     │
│  Input: Natural language + Rules + Presets                   │
│  Output: RSNT tree + Confidence score                        │
│  Technology: Claude 3.5 Sonnet API                           │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│             RECURSIVE SEMANTIC NODE TREE (RSNT)               │
│                                                               │
│  Platform-agnostic intermediate representation                │
│  Structured JSON describing semantic design                   │
│  Validated against strict schema                              │
└────────┬────────────────────────────────────┬────────────────┘
         │                                    │
         │         ┌──────────────────────────┘
         │         │
         ▼         ▼
┌─────────────────────────┐        ┌───────────────────────────┐
│   DISCOVERY SERVICE     │◄──────►│   RESOLUTION SERVICE      │
│                         │        │                           │
│ Role: Understand client │        │ Role: Map RSNT → Assets  │
│ Input: Figma file       │        │ Input: RSNT + Fingerprints│
│ Output: Fingerprints    │        │ Output: Execution instr.  │
│ Cached: 24 hours        │        │ Strategy: 5-tier fallback │
└─────────────────────────┘        └──────────┬────────────────┘
                                              │
                                              ▼
                             ┌──────────────────────────────────┐
                             │      EXECUTION SERVICE           │
                             │                                  │
                             │ Role: Render in Figma            │
                             │ Input: Execution instructions    │
                             │ Output: Figma nodes + metadata   │
                             │ Technology: Figma Plugin API     │
                             └──────────┬───────────────────────┘
                                        │
                                        ▼
                             ┌──────────────────────────────────┐
                             │         FIGMA OUTPUT             │
                             │                                  │
                             │ Auto Layout frames + components  │
                             │ Semantic metadata attached       │
                             │ Ready for code export            │
                             └──────────────────────────────────┘
2.2.2 Service Responsibilities
Discovery Service
Runs: Once per file (or when structure changes)
Purpose: Understand what's available in the client's file
Inputs: Figma file (components, variables, styles)
Outputs:
Component fingerprints (what each component is semantically)
Variable inventory (all design tokens)
Semantic mappings (client names → standard names)
Stateful: Yes (results cached for 24 hours)
Performance: 5-10 seconds uncached, <100ms cached
AI Orchestration Service
Runs: Every generation request
Purpose: Translate human intent to machine-readable structure
Inputs:
User text ("Create login card")
Rule library
Preset selection (Shadcn, Radix, etc.)
Context (platform, constraints)
Outputs:
RSNT tree
Confidence score (0-1)
Explanation of decisions made
Stateful: No (pure function)
Performance: 1-7 seconds depending on complexity
Resolution Service
Runs: For each RSNT node during generation
Purpose: Decide how to create each semantic element
Inputs:
RSNT node (semantic description)
Discovery fingerprints (what's available)
Preset rules (if applicable)
Outputs:
Execution instructions (use component X, or build from scratch)
Fallback tier used (1-5)
Warnings (if lower-tier fallback used)
Stateful: Yes (caches resolution decisions)
Performance: <10ms per node (cached), <50ms per node (uncached)
Execution Service
Runs: After all nodes resolved
Purpose: Create actual Figma nodes on canvas
Inputs:
Execution instructions for each node
RSNT tree (for metadata)
Outputs:
Figma frames and components
Auto Layout configured
Metadata attached
Stateful: No (idempotent operations)
Performance: ~20ms per node created
Semantic Output Service
Runs: On-demand when user exports code
Purpose: Generate production code from Figma + metadata
Inputs:
Figma nodes (visual structure)
RSNT metadata (semantic meaning)
Export preferences (format, framework)
Outputs:
React/Vue/HTML code
Tailwind classes
Component imports
State management (if applicable)
Stateful: No
Performance: <1 second for most designs
2.2.3 Data Flow Example (Login Card Generation)
Step 1: User Input
Intent: "Create a login card with email and password fields"
Preset: Shadcn UI
Constraints: max-width 400px, comfortable spacing
Step 2: AI Orchestration
AI receives:
- Intent text
- Shadcn rules (Button h-10, Input h-10, Card p-6, etc.)
- Creator rules (form spacing, field layout)
- Available semantic roles & layout primitives

AI generates RSNT:
{
  semanticRole: "Card",
  layoutPrimitive: "stack-v",
  tailwindClasses: ["p-8", "gap-6", "max-w-md"],
  children: [
    { semanticRole: "Heading", props: { text: "Welcome back" } },
    { semanticRole: "Form", children: [
      { semanticRole: "FormField", children: [
        { semanticRole: "Label", props: { text: "Email" } },
        { semanticRole: "Input", props: { type: "email" } }
      ]},
      // ... more fields
    ]}
  ]
}

Confidence: 0.92 (high)
Step 3: Discovery Check
Check cache: Has file been fingerprinted?
- Yes → Use cached fingerprints
- Cached data includes:
  - Button component (Type: Filled/Outline, Size: Default/Large)
  - Input component (Size: Default)
  - Card component (exists)
  - Variables: brand-primary, spacing-4, etc.
Step 4: Resolution (per node)
For Card node:
- Tier 1: Check for Card component → Found
- Property mapping: p-8 → use card's default padding (24px)
- Decision: Use client's Card component

For Input node:
- Tier 1: Check for Input component → Found
- Property mapping: type="email" → set Type=email property
- Decision: Use client's Input component

Result: All nodes resolved via Tier 1 (library components)
Step 5: Conflict Check
Check for conflicts:
- Card padding: RSNT says p-8 (32px), component has p-6 (24px)
- Conflict detected!
- Priority hierarchy: Component (P1) > Preset (P2) > RSNT
- Resolution: Use component's p-6 (24px)
- Log conflict for designer review
Step 6: Execution
Create Figma nodes:
1. Instantiate Card component → cardInstance
2. Inside card, create form structure:
   - Create Label text node
   - Instantiate Input component
   - Repeat for password field
3. Configure Auto Layout:
   - Card: VERTICAL, gap 24px, padding 24px
   - Form: VERTICAL, gap 16px
4. Attach metadata to each node:
   - Store RSNT fragment in pluginData
   - Store generation metadata (version, timestamp)
5. Set constraints:
   - Card: FILL width, HUG height
   - Inputs: FILL width, FIXED height
Step 7: Result
Designer sees:
- Login card appears in canvas
- Positioned at cursor location
- Notification: "Generated successfully"
- Warning badge: "1 conflict auto-resolved (click to review)"
- Code export button enabled
Step 8: Code Export (if designer clicks)
Generate React code:

import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export function LoginCard() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <h2 className="text-2xl font-semibold">Welcome back</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" />
        </div>
        <Button className="w-full">Sign in</Button>
      </CardContent>
    </Card>
  )
}
2.3 Technology Stack
2.3.1 Core Technologies
Runtime Environment:
Platform: Figma Plugin Sandbox
Language: TypeScript 5.0+
Build Tool: Vite (fast builds, HMR)
Package Manager: npm
AI Integration:
Provider: Anthropic
Model: Claude 3.5 Sonnet
API: REST API (HTTPS)
Fallback: Local rule engine (if offline mode enabled)
Data Storage:
Primary: Figma clientStorage (per-file, persistent)
Cache: In-memory (per-session, fast)
Backup: Figma pluginData (per-node metadata)
UI Framework:
Approach: Vanilla JavaScript (no framework overhead)
Styling: Tailwind-inspired utility classes
Icons: Lucide Icons (lightweight)
2.3.2 Key Dependencies
Required:
Figma Plugin API (built-in, no install needed)
Anthropic SDK (API client)
Optional:
UUID library (generate unique IDs)
Color conversion utilities (CIELAB calculations)
Not Needed:
No database (Figma handles persistence)
No backend server (serverless via API)
No UI framework (vanilla JS sufficient)
2.3.3 Development Tools
Development:
IDE: VS Code (recommended)
Debugging: Figma Plugin Dev Console
Testing: Jest (unit tests), Playwright (integration)
Linting: ESLint + Prettier
Deployment:
Distribution: Figma Community Plugins
Updates: Automatic (Figma handles)
Versioning: Semantic versioning (semver)

3. Data Schema: Recursive Semantic Node Tree (RSNT)
3.1 What is RSNT?
The Recursive Semantic Node Tree (RSNT) is the system's intermediate representation — a platform-agnostic, strictly typed data structure that represents a design's logical structure independent of any specific design system or visual styling.
Purpose:
Describe WHAT elements exist (semantically)
Describe HOW elements are arranged (structurally)
Avoid describing visual specifics (colors, exact dimensions)
Enable portability (same RSNT → different visual outputs)
Key Characteristics:
Semantic:
Nodes describe meaning, not appearance
"PrimaryButton" not "blue rounded rectangle"
"FormField" not "stack with label and input"
Recursive:
Nodes can contain child nodes infinitely
Tree structure (root + branches + leaves)
Maximum depth limit to prevent infinite recursion
Typed:
Strict schema prevents invalid structures
All properties validated
Schema violations caught before execution
Portable:
Can be serialized to JSON
Can be version controlled
Can be rendered in Figma, React, SwiftUI, etc.
Deterministic:
Same RSNT always produces same output (given same environment)
No random elements
No undefined behavior
3.2 RSNT Node Structure
Each RSNT node is a self-contained unit with complete information about one design element.
3.2.1 Core Properties
Identity Properties:
id (string, required)
Unique identifier for this node
Format: UUID v4
Example: "btn-a7f2e4d1-3c5b-4a8e-9f1d-2b6c8e3a9d4f"
Purpose: Reference nodes, prevent duplicates
semanticRole (string, required)
What this element IS semantically
Must be from approved list (or client-defined)
Examples: "PrimaryButton", "FormField", "Card", "Heading"
Purpose: Determines how element is resolved and rendered
Layout Properties:
layoutPrimitive (string, required)
HOW this element is structured
Must be from approved list (or client-defined)
Examples: "stack-v", "flex-center-both", "grid-2-col"
Purpose: Determines Auto Layout configuration
tailwindClasses (string[], required)
Visual styling as Tailwind utility classes
Must be valid Tailwind classes
Examples: ["p-4", "gap-2", "bg-primary", "rounded-md"]
Purpose: Provides styling hints for resolution and code export
Content Properties:
props (object, optional)
Element-specific properties
Flexible key-value pairs
Common props:
label (string): Text content
placeholder (string): Input placeholder
variant (string): Style variant (primary, secondary, ghost, etc.)
size (string): Size variant (sm, md, lg, xl)
icon (string): Icon identifier
disabled (boolean): Disabled state
loading (boolean): Loading state
required (boolean): Required field
ariaLabel (string): Accessibility label
Custom props allowed for extensibility
Structural Properties:
children (RSNT_Node[], optional)
Nested child nodes
Array of RSNT nodes (recursive)
Order matters (rendering order)
Can be empty array or omitted
constraints (object, required)
Sizing behavior
Properties:
width: "hug" | "fill" | "fixed"
height: "hug" | "fill" | "fixed"
minWidth (number, optional): Minimum width in pixels
maxWidth (number, optional): Maximum width in pixels
minHeight (number, optional): Minimum height in pixels
maxHeight (number, optional): Maximum height in pixels
3.2.2 Advanced Properties
stateVariants (object, optional)
Different configurations for different states
Keys: hover, focus, active, disabled, error, loading
Values: Partial RSNT nodes (overrides)
Purpose: Define how element looks/behaves in each state
conditionalRender (object, optional)
Logic for when to show/hide element
Properties:
showIf (ConditionalExpression): Condition to evaluate
fallback (RSNT_Node, optional): Alternative node if condition false
Purpose: Dynamic visibility
responsive (object, optional)
Different configurations per breakpoint
Keys: mobile, tablet, desktop
Values: Partial RSNT nodes (overrides)
Purpose: Responsive behavior
Metadata Properties:
metadata (object, required)
Generation and tracking information
Properties:
source: "ai" | "recorded" | "manual"
ruleVersion (string): Rule set version used
presetUsed (string, optional): Preset name (e.g., "shadcn-v1.3.0")
createdAt (string): ISO 8601 timestamp
confidence (number, optional): AI confidence (0-1)
3.3 Complete RSNT Schema Definition
3.3.1 TypeScript-Style Schema
interface RSNT_Node {
  // === IDENTITY ===
  id: string
  semanticRole: SemanticRole
  
  // === LAYOUT ===
  layoutPrimitive: LayoutPrimitive
  tailwindClasses: string[]
  
  // === CONTENT ===
  props: {
    label?: string
    placeholder?: string
    value?: string | number
    variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | string
    size?: 'sm' | 'md' | 'lg' | 'xl' | string
    icon?: string
    disabled?: boolean
    loading?: boolean
    required?: boolean
    ariaLabel?: string
    ariaDescribedBy?: string
    [key: string]: any  // Extensible
  }
  
  // === STRUCTURE ===
  children?: RSNT_Node[]
  constraints: {
    width: 'hug' | 'fill' | 'fixed'
    height: 'hug' | 'fill' | 'fixed'
    minWidth?: number
    maxWidth?: number
    minHeight?: number
    maxHeight?: number
  }
  
  // === ADVANCED ===
  stateVariants?: {
    hover?: Partial<RSNT_Node>
    focus?: Partial<RSNT_Node>
    active?: Partial<RSNT_Node>
    disabled?: Partial<RSNT_Node>
    error?: Partial<RSNT_Node>
    loading?: Partial<RSNT_Node>
  }
  
  conditionalRender?: {
    showIf: ConditionalExpression
    fallback?: RSNT_Node
  }
  
  responsive?: {
    mobile?: Partial<RSNT_Node>
    tablet?: Partial<RSNT_Node>
    desktop?: Partial<RSNT_Node>
  }
  
  // === METADATA ===
  metadata: {
    source: 'ai' | 'recorded' | 'manual'
    ruleVersion: string
    presetUsed?: string
    createdAt: string
    confidence?: number
  }
}

// Supporting Types

type SemanticRole = 
  // Layout containers
  | 'Page' | 'Section' | 'Container' | 'Card' | 'Panel'
  // Form elements
  | 'Form' | 'FormField' | 'Input' | 'TextArea' | 'Select' | 'Label'
  // Buttons
  | 'PrimaryButton' | 'SecondaryButton' | 'GhostButton' | 'DestructiveButton'
  // Navigation
  | 'Nav' | 'NavItem' | 'Tabs' | 'TabsList' | 'TabsTrigger'
  // Typography
  | 'Heading' | 'Subheading' | 'Paragraph' | 'Caption'
  // Feedback
  | 'Alert' | 'Toast' | 'Badge' | 'Spinner' | 'Progress'
  // Overlays
  | 'Dialog' | 'Sheet' | 'Popover' | 'Tooltip' | 'DropdownMenu'
  // Data display
  | 'Table' | 'TableRow' | 'TableCell' | 'List' | 'ListItem' | 'Avatar'
  // Custom
  | string

type LayoutPrimitive = 
  // Flex layouts
  | 'stack-v' | 'stack-v-start' | 'stack-v-center'
  | 'stack-h' | 'stack-h-center'
  | 'flex-center-both' | 'flex-space-between' | 'flex-wrap'
  // Grid layouts
  | 'grid-2-col' | 'grid-3-col' | 'grid-4-col'
  | 'grid-auto-fill' | 'grid-responsive'
  // Special layouts
  | 'inset-square' | 'full-bleed' | 'constrained-center'
  | 'sidebar-layout' | 'sticky-header'
  // Custom
  | string

interface ConditionalExpression {
  type: 'boolean' | 'comparison' | 'compound'
  
  // For boolean type
  variable?: string
  
  // For comparison type
  left?: string
  operator?: '==' | '!=' | '>' | '<' | '>=' | '<='
  right?: string | number | boolean
  
  // For compound type
  conditions?: ConditionalExpression[]
  logic?: 'AND' | 'OR'
}
3.4 RSNT Examples
3.4.1 Example 1: Simple Primary Button
Visual Description: A blue button with white text, "Submit" label, medium size, with standard padding and rounded corners.
RSNT Representation:
{
  "id": "btn-001",
  "semanticRole": "PrimaryButton",
  "layoutPrimitive": "stack-h-center",
  "tailwindClasses": [
    "px-4",
    "py-2",
    "gap-2",
    "rounded-md",
    "bg-primary",
    "text-primary-foreground"
  ],
  "props": {
    "label": "Submit",
    "variant": "primary",
    "size": "md"
  },
  "children": [],
  "constraints": {
    "width": "hug",
    "height": "hug"
  },
  "metadata": {
    "source": "ai",
    "ruleVersion": "1.0.0",
    "presetUsed": "shadcn-v1.3.0",
    "createdAt": "2026-01-27T10:30:00Z",
    "confidence": 0.95
  }
}
Key Points:
Semantic role clearly states this is a primary action button
Layout primitive specifies horizontal stack with center alignment
Tailwind classes provide styling hints (but actual colors come from client variables)
Props include user-facing content (label) and semantic attributes (variant, size)
Constraints set to "hug" (size to content)
No children (button is a leaf node)
High confidence score (0.95) from AI
3.4.2 Example 2: Form Field (Label + Input)
Visual Description: A form field with "Email" label above an email input with placeholder text.
RSNT Representation:
{
  "id": "field-email-001",
  "semanticRole": "FormField",
  "layoutPrimitive": "stack-v",
  "tailwindClasses": ["gap-2"],
  "props": {},
  "children": [
    {
      "id": "label-email-001",
      "semanticRole": "Label",
      "layoutPrimitive": "stack-v",
      "tailwindClasses": ["text-sm", "font-medium"],
      "props": {
        "text": "Email",
        "htmlFor": "email-input"
      },
      "children": [],
      "constraints": {
        "width": "fill",
        "height": "hug"
      },
      "metadata": {
        "source": "ai",
        "ruleVersion": "1.0.0",
        "createdAt": "2026-01-27T10:30:00Z"
      }
    },
    {
      "id": "input-email-001",
      "semanticRole": "Input",
      "layoutPrimitive": "stack-h",
      "tailwindClasses": [
        "h-10",
        "w-full",
        "rounded-md",
        "border",
        "px-3",
        "py-2"
      ],
      "props": {
        "type": "email",
        "placeholder": "you@example.com",
        "required": true,
        "ariaLabel": "Email address"
      },
      "children": [],
      "constraints": {
        "width": "fill",
        "height": "fixed"
      },
      "stateVariants": {
        "error": {
          "tailwindClasses": ["border-destructive", "focus:ring-destructive"]
        },
        "disabled": {
          "tailwindClasses": ["opacity-50", "cursor-not-allowed"],
          "props": {
            "disabled": true
          }
        }
      },
      "metadata": {
        "source": "ai",
        "ruleVersion": "1.0.0",
        "presetUsed": "shadcn-v1.3.0",
        "createdAt": "2026-01-27T10:30:00Z"
      }
    }
  ],
  "constraints": {
    "width": "fill",
    "height": "hug"
  },
  "metadata": {
    "source": "ai",
    "ruleVersion": "1.0.0",
    "createdAt": "2026-01-27T10:30:00Z"
  }
}
Key Points:
Parent node (FormField) contains two children (Label + Input)
Vertical stack layout with 8px gap (gap-2)
Label is semantic (not just text node)
Input has state variants for error and disabled states
Input constraints: fill width (responsive), fixed height (consistent)
Accessibility properties included (htmlFor, ariaLabel)
3.4.3 Example 3: Complete Login Card (Complex Nested Structure)
Visual Description: A complete login form card with header (title + subtitle), two form fields (email + password), conditional error alert, and two buttons (submit + forgot password link).
RSNT Representation:
{
  "id": "card-login-001",
  "semanticRole": "Card",
  "layoutPrimitive": "stack-v",
  "tailwindClasses": [
    "p-8",
    "gap-6",
    "rounded-lg",
    "shadow-lg",
    "bg-card",
    "border"
  ],
  "props": {},
  "children": [
    // === HEADER SECTION ===
    {
      "id": "header-001",
      "semanticRole": "Container",
      "layoutPrimitive": "stack-v",
      "tailwindClasses": ["gap-2"],
      "props": {},
      "children": [
        {
          "id": "heading-001",
          "semanticRole": "Heading",
          "layoutPrimitive": "stack-v",
          "tailwindClasses": [
            "text-2xl",
            "font-semibold",
            "tracking-tight"
          ],
          "props": {
            "level": 2,
            "text": "Welcome back"
          },
          "children": [],
          "constraints": { "width": "fill", "height": "hug" },
          "metadata": {
            "source": "ai",
            "ruleVersion": "1.0.0",
            "createdAt": "2026-01-27T10:30:00Z"
          }
        },
        {
          "id": "subheading-001",
          "semanticRole": "Paragraph",
          "layoutPrimitive": "stack-v",
          "tailwindClasses": ["text-sm", "text-muted-foreground"],
          "props": {
            "text": "Enter your credentials to continue"
          },
          "children": [],
          "constraints": { "width": "fill", "height": "hug" },
          "metadata": {
            "source": "ai",
            "ruleVersion": "1.0.0",
            "createdAt": "2026-01-27T10:30:00Z"
          }
        }
      ],
      "constraints": { "width": "fill", "height": "hug" },
      "metadata": {
        "source": "ai",
        "ruleVersion": "1.0.0",
        "createdAt": "2026-01-27T10:30:00Z"
      }
    },
    
    // === FORM SECTION ===
    {
      "id": "form-001",
      "semanticRole": "Form",
      "layoutPrimitive": "stack-v",
      "tailwindClasses": ["gap-4"],
      "props": {},
      "children": [
        // Email Field (see Example 2 for full structure)
        {
          "id": "field-email-001",
          "semanticRole": "FormField",
          "layoutPrimitive": "stack-v",
          "tailwindClasses": ["gap-2"],
          "props": {},
          "children": [
            // Label + Input children (omitted for brevity)
          ],
          "constraints": { "width": "fill", "height": "hug" },
          "metadata": {
            "source": "ai",
            "ruleVersion": "1.0.0",
            "createdAt": "2026-01-27T10:30:00Z"
          }
        },
        
        // Password Field
        {
          "id": "field-password-001",
          "semanticRole": "FormField",
          "layoutPrimitive": "stack-v",
          "tailwindClasses": ["gap-2"],
          "props": {},
          "children": [
            // Label + Input children (similar to email)
          ],
          "constraints": { "width": "fill", "height": "hug" },
          "metadata": {
            "source": "ai",
            "ruleVersion": "1.0.0",
            "createdAt": "2026-01-27T10:30:00Z"
          }
        },
        
        // Error Alert (Conditional)
        {
          "id": "alert-error-001",
          "semanticRole": "Alert",
          "layoutPrimitive": "stack-h",
          "tailwindClasses": [
            "p-3",
            "gap-2",
            "rounded-md",
            "bg-destructive/10",
            "text-destructive",
            "text-sm"
          ],
          "props": {
            "variant": "destructive",
            "message": "Invalid credentials. Please try again."
          },
          "children": [],
          "constraints": { "width": "fill", "height": "hug" },
          "conditionalRender": {
            "showIf": {
              "type": "boolean",
              "variable": "hasError"
            }
          },
          "metadata": {
            "source": "ai",
            "ruleVersion": "1.0.0",
            "createdAt": "2026-01-27T10:30:00Z"
          }
        }
      ],
      "constraints": { "width": "fill", "height": "hug" },
      "metadata": {
        "source": "ai",
        "ruleVersion": "1.0.0",
        "createdAt": "2026-01-27T10:30:00Z"
      }
    },
    
    // === ACTIONS SECTION ===
    {
      "id": "actions-001",
      "semanticRole": "ButtonGroup",
      "layoutPrimitive": "stack-v",
      "tailwindClasses": ["gap-2"],
      "props": {},
      "children": [
        {
          "id": "btn-submit-001",
          "semanticRole": "PrimaryButton",
          "layoutPrimitive": "stack-h-center",
          "tailwindClasses": [
            "h-10",
            "w-full",
            "rounded-md",
            "bg-primary",
            "px-4",
            "py-2",
            "text-primary-foreground"
          ],
          "props": {
            "label": "Sign in",
            "variant": "primary",
            "size": "md"
          },
          "children": [],
          "constraints": { "width": "fill", "height": "fixed" },
          "stateVariants": {
            "loading": {
              "props": {
                "label": "Signing in...",
                "disabled": true
              },
              "children": [
                {
                  "id": "spinner-001",
                  "semanticRole": "Spinner",
                  "layoutPrimitive": "stack-h",
                  "tailwindClasses": ["animate-spin", "mr-2"],
                  "props": {},
                  "children": [],
                  "constraints": { "width": "hug", "height": "hug" },
                  "metadata": {
                    "source": "ai",
                    "ruleVersion": "1.0.0",
                    "createdAt": "2026-01-27T10:30:00Z"
                  }
                }
              ]
            }
          },
          "metadata": {
            "source": "ai",
            "ruleVersion": "1.0.0",
            "presetUsed": "shadcn-v1.3.0",
            "createdAt": "2026-01-27T10:30:00Z"
          }
        },
        {
          "id": "btn-forgot-001",
          "semanticRole": "GhostButton",
          "layoutPrimitive": "stack-h-center",
          "tailwindClasses": [
            "h-10",
            "w-full",
            "rounded-md",
            "text-sm",
            "underline-offset-4",
            "hover:underline"
          ],
          "props": {
            "label": "Forgot password?",
            "variant": "ghost",
            "size": "sm"
          },
          "children": [],
          "constraints": { "width": "fill", "height": "fixed" },
          "metadata": {
            "source": "ai",
            "ruleVersion": "1.0.0",
            "presetUsed": "shadcn-v1.3.0",
            "createdAt": "2026-01-27T10:30:00Z"
          }
        }
      ],
      "constraints": { "width": "fill", "height": "hug" },
      "metadata": {
        "source": "ai",
        "ruleVersion": "1.0.0",
        "createdAt": "2026-01-27T10:30:00Z"
      }
    }
  ],
  "constraints": {
    "width": "fixed",
    "height": "hug",
    "maxWidth": 400
  },
  "metadata": {
    "source": "ai",
    "ruleVersion": "1.0.0",
    "presetUsed": "shadcn-v1.3.0",
    "createdAt": "2026-01-27T10:30:00Z",
    "confidence": 0.92
  }
}
Key Points:
Total nodes: 13 (1 root + 12 descendants)
Max depth: 4 levels deep
Hierarchy: Card → Header/Form/Actions → FormFields → Label/Input
Conditional element: Error alert only shows when hasError = true
State variant: Submit button has loading state with spinner
Responsive: Card has fixed max-width (400px) for desktop, would adapt on mobile
Confidence: 0.92 (high, would auto-generate without approval)
3.4.4 Example 4: Responsive Dashboard Widget
Visual Description: A statistics card showing revenue with different text sizes on mobile vs desktop.
RSNT Representation:
{
  "id": "widget-stats-001",
  "semanticRole": "Card",
  "layoutPrimitive": "stack-v",
  "tailwindClasses": [
    "p-6",
    "gap-4",
    "rounded-lg",
    "border",
    "bg-card"
  ],
  "props": {},
  "children": [
    {
      "id": "widget-header-001",
      "semanticRole": "Container",
      "layoutPrimitive": "stack-h-center",
      "tailwindClasses": ["justify-between"],
      "props": {},
      "children": [
        {
          "id": "widget-title-001",
          "semanticRole": "Heading",
          "layoutPrimitive": "stack-v",
          "tailwindClasses": ["text-sm", "font-medium"],
          "props": {
            "level": 3,
            "text": "Total Revenue"
          },
          "children": [],
          "constraints": { "width": "hug", "height": "hug" },
          "metadata": {
            "source": "ai",
            "ruleVersion": "1.0.0",
            "createdAt": "2026-01-27T10:30:00Z"
          }
        },
        {
          "id": "widget-icon-001",
          "semanticRole": "Icon",
          "layoutPrimitive": "flex-center-both",
          "tailwindClasses": ["h-4", "w-4", "text-muted-foreground"],
          "props": {
            "icon": "dollar-sign"
          },
          "children": [],
          "constraints": { "width": "fixed", "height": "fixed" },
          "metadata": {
            "source": "ai",
            "ruleVersion": "1.0.0",
            "createdAt": "2026-01-27T10:30:00Z"
          }
        }
      ],
      "constraints": { "width": "fill", "height": "hug" },
      "metadata": {
        "source": "ai",
        "ruleVersion": "1.0.0",
        "createdAt": "2026-01-27T10:30:00Z"
      }
    },
    {
      "id": "widget-value-001",
      "semanticRole": "Container",
      "layoutPrimitive": "stack-v",
      "tailwindClasses": ["gap-1"],
      "props": {},
      "children": [
        {
          "id": "widget-amount-001",
          "semanticRole": "Heading",
          "layoutPrimitive": "stack-v",
          "tailwindClasses": ["text-3xl", "font-bold"],
          "props": {
            "level": 2,
            "text": "$45,231.89"
          },
          "children": [],
          "constraints": { "width": "hug", "height": "hug" },
          "responsive": {
            "mobile": {
              "tailwindClasses": ["text-2xl", "font-bold"]
            },
            "tablet": {
              "tailwindClasses": ["text-3xl", "font-bold"]
            },
            "desktop": {
              "tailwindClasses": ["text-4xl", "font-bold"]
            }
          },
          "metadata": {
            "source": "ai",
            "ruleVersion": "1.0.0",
            "createdAt": "2026-01-27T10:30:00Z"
          }
        },
        {
          "id": "widget-change-001",
          "semanticRole": "Paragraph",
          "layoutPrimitive": "stack-v",
          "tailwindClasses": ["text-xs", "text-muted-foreground"],
          "props": {
            "text": "+20.1% from last month"
          },
          "children": [],
          "constraints": { "width": "hug", "height": "hug" },
          "metadata": {
            "source": "ai",
            "ruleVersion": "1.0.0",
            "createdAt": "2026-01-27T10:30:00Z"
          }
        }
      ],
      "constraints": { "width": "fill", "height": "hug" },
      "metadata": {
        "source": "ai",
        "ruleVersion": "1.0.0",
        "createdAt": "2026-01-27T10:30:00Z"
          }
    }
  ],
  "constraints": {
    "width": "fill",
    "height": "hug"
  },
  "responsive": {
    "mobile": {
      "tailwindClasses": ["p-4", "gap-3"]
    },
    "tablet": {
      "tailwindClasses": ["p-6", "gap-4"]
    },
    "desktop": {
      "tailwindClasses": ["p-8", "gap-6"]
    }
  },
  "metadata": {
    "source": "ai",
    "ruleVersion": "1.0.0",
    "presetUsed": "shadcn-v1.3.0",
    "createdAt": "2026-01-27T10:30:00Z",
    "confidence": 0.88
  }
}
Key Points:
Responsive behavior: Different padding and text sizes per breakpoint
Mobile: p-4 padding, text-2xl amount
Tablet: p-6 padding, text-3xl amount
Desktop: p-8 padding, text-4xl amount
Code export: Will generate responsive Tailwind classes (text-2xl md:text-3xl lg:text-4xl)
Figma rendering: Will create 3 separate frames (mobile, tablet, desktop) for review
3.5 RSNT Validation System
Before an RSNT tree can be executed, it must pass validation to ensure structural integrity.
3.5.1 Validation Rules
Rule 1: ID Uniqueness
Every node ID must be unique within the tree
Duplicate IDs cause rendering errors
Validation: Collect all IDs, check for duplicates
Rule 2: Semantic Role Validity
All semantic roles must be in approved list OR client-defined
Unknown roles flagged as error
Validation: Check against role registry
Rule 3: Layout Primitive Validity
All layout primitives must be in approved list OR client-defined
Unknown primitives flagged as error
Validation: Check against primitive registry
Rule 4: Tailwind Class Validity
All Tailwind classes must be valid utilities
Unknown classes flagged as warning (not error, allows custom)
Validation: Check against Tailwind class reference
Rule 5: Constraint Completeness
If width/height is "fixed", must specify maxWidth/maxHeight
Missing constraints flagged as error
Validation: Check constraint object completeness
Rule 6: Maximum Nesting Depth
Tree depth must not exceed maximum (default: 8 levels)
Prevents infinite recursion and performance issues
Validation: Recursively calculate depth
Rule 7: Circular References
No node can contain itself as descendant
Prevents infinite loops
Validation: Track node path during traversal
Rule 8: Required Props
Certain semantic roles require specific props
Example: Input requires "type" prop
Validation: Check required props per role
3.5.2 Validation Outcomes
Valid:
All rules passed
Ready for execution
Proceed to resolution
Warnings:
Minor issues detected
Can still execute
Designer notified of issues
Examples:
Using custom Tailwind classes (may not work)
Deep nesting (may be slow)
Missing optional props (may look incomplete)
Errors:
Critical issues detected
Cannot execute safely
Designer must fix before proceeding
Examples:
Duplicate IDs
Invalid semantic roles
Missing required constraints
Circular references
Exceeded max depth
3.5.3 Validation Error Messages
Good Error Messages:
Specific: "Duplicate ID 'btn-001' found in nodes at paths /card/actions/button[0] and /card/footer/button[0]"
Actionable: "To fix: Change one of the button IDs to a unique value"
Contextual: "This error prevents rendering because Figma requires unique node names"
Bad Error Messages:
Vague: "Invalid RSNT"
Not actionable: "Error at node 5"
No context: "Validation failed"

4. Discovery Service: Fingerprinting & Mapping
4.1 Purpose & Responsibility
The Discovery Service is the system's "eyes" — it automatically scans and understands the client's Figma environment so the plugin can work without manual configuration.
Core Responsibility: Automatically detect, analyze, and semantically map all components, variables, and styles in the client's file.
Why It's Critical:
Enables zero-setup experience
Works with any design system
Finds best matches for RSNT elements
Caches results for performance
When It Runs:
First plugin use in a file (full scan)
File version changes (incremental scan)
Manual refresh requested (user trigger)
Cache expires (24 hours)
4.2 Discovery Pipeline
The Discovery process follows a 6-step pipeline:
Step 1: Component Scanning
Duration: 2-5 seconds for 200 components
Process:
Find all Component and ComponentSet nodes in file
Extract properties for each component:
Name and hierarchy (Button/Primary/Large)
Variant properties and values ([Type: Filled/Outline], [Size: Small/Default/Large])
Layer structure (children, nesting, types)
Auto Layout configuration (direction, alignment, spacing)
Styling (fills, strokes, effects, corner radius)
Variable bindings (which variables are used where)
Output:
Raw component inventory (array of component objects)
200 components → ~500KB JSON data
Step 2: Component Fingerprinting
Duration: 3-8 seconds (includes AI analysis)
Purpose: Identify what each component semantically IS by analyzing its structure and properties.
Analysis Methods:
A) Variant Property Analysis (AI-Powered)
For each component property (e.g., "Type", "Size", "State"):
Send property name and values to AI


AI classifies property type:


SEMANTIC_VARIANT (visual style: primary, secondary, ghost)
SEMANTIC_SIZE (dimensions: sm, md, lg, xl)
SEMANTIC_STATE (interaction: default, hover, disabled)
SEMANTIC_STYLE (fill variation: filled, outline, soft)
SEMANTIC_CUSTOM (client-specific, not standard)
AI maps each value to standardized equivalent:


"Filled" → "primary" (confidence 0.9)
"Outlined" → "secondary" (confidence 0.85)
"Text" → "ghost" (confidence 0.8)
Example:
Component Property: "Emphasis"
Values: ["High", "Medium", "Low"]

AI Analysis:
- Property Type: SEMANTIC_VARIANT
- Mappings:
  - High → primary (confidence 0.85)
  - Medium → secondary (confidence 0.85)
  - Low → ghost (confidence 0.8)
B) Anatomy Analysis (Pattern Recognition)
Examine component layer structure:
Detect semantic elements:


Icon presence (layer named "icon" or component instance)
Label presence (TEXT node or layer named "label")
Image presence (RECTANGLE with image fill)
Container presence (FRAME with multiple children)
Calculate structure signature:


Hash of layer types and names
Used for similarity matching
Match against known patterns:


Icon + Label = Button pattern
Label + Input + Container = FormField pattern
Multiple children in vertical stack = Card pattern
Example:
Component: "MyButton"
Layers:
- FRAME (root)
  - COMPONENT_INSTANCE (icon)
  - TEXT (label)

Anatomy Detection:
- hasIcon: true
- hasLabel: true
- layerCount: 3
- structureHash: "a7f2e4d1"

Pattern Match: "ActionableElement" (Button)
Confidence: 0.9
C) Naming Convention Analysis (Heuristics)
Extract semantic hints from component names:
Check for common keywords:


"Button" → Button semantic role
"Input" → Input semantic role
"Card" → Card semantic role
"Primary" → primary variant
"Large" → lg size
Parse hierarchical names:


"Button/Primary/Large" → Button (role), Primary (variant), Large (size)
Use as supporting evidence for AI classification


Output:
Component fingerprint database
Each component mapped to:
Inferred semantic role (with confidence)
Property mappings (client props → semantic props)
Structure signature
Anatomy flags (hasIcon, hasLabel, etc.)
Step 3: Variable Scanning
Duration: 1-2 seconds
Process:
Find all Variable Collections in file


For each collection:


Extract collection name and modes
Get all variables in collection
Read variable properties:
Name (e.g., "colors/primary-600")
Type (COLOR, FLOAT, STRING, BOOLEAN)
Value (resolved for default mode)
Scopes (which properties it can be applied to)
Build inventory:


Color palette (all color variables)
Spacing scale (all numeric variables for padding/gap)
Other variables (strings, booleans)
Output:
Variable inventory (organized by collection and type)
50 variables → ~20KB JSON data
Step 4: Variable Resolution Strategy
Duration: 2-5 seconds (includes AI semantic matching)
Purpose: Map semantic tokens (e.g., "colors/blue/500") to actual client variables.
Three-Tier Matching:
Tier 1: Exact Match
Normalize names: "colors/blue/500" → "colors-blue-500"
Check if client has variable with exact name
Confidence: 1.0 if found
Fast (simple string comparison)
Tier 2: Semantic Alias Match
Check if variable name matches common aliases
Alias database:
"colors/blue/500" aliases: ["primary", "brand-primary", "sys-color-primary"]
"spacing/4" aliases: ["space-4", "spacing-md", "gap-medium"]
Confidence: 0.85 if found
Medium speed (dictionary lookup)
Tier 3: Proximity Match (Colors Only)
Convert Tailwind color to CIELAB color space
Calculate CIELAB ΔE (Delta E) to each client color variable
Find closest match with ΔE < 10
Confidence: function of ΔE
ΔE < 2: confidence 0.95-1.0 (imperceptible)
ΔE 2-5: confidence 0.8-0.95 (perceptible but acceptable)
ΔE 5-10: confidence 0.6-0.8 (noticeable but usable)
Slow (color conversion + distance calculation for each variable)
Why CIELAB? Unlike RGB, CIELAB is perceptually uniform. A ΔE of 2 represents the same perceptual difference whether comparing light blues or dark reds. This makes it ideal for "close enough" color matching.
Example:
Requested: colors/blue/500 (#3B82F6)

Client Variables:
- brand-primary (#0ea5e9)
- accent-blue (#3b7bc8)
- text-primary (#000000)

Tier 1: No exact match "colors-blue-500"
Tier 2: Check aliases ["primary", "brand-primary"]
  - Found: "brand-primary" → confidence 0.85
Tier 3: Calculate ΔE:
  - brand-primary: ΔE = 12.3 (too different)
  - accent-blue: ΔE = 3.8 (acceptable)
  
Best Match: brand-primary (Tier 2, confidence 0.85)
Alternative: accent-blue (Tier 3, confidence 0.78)
Step 5: Designer Approval (Low-Confidence Matches)
Duration: Varies (waits for designer input)
Trigger: Any variable match with confidence < 0.8
Process:
Collect all low-confidence matches
Show batch approval dialog
For each match, show:
Requested token name
Best match found
Confidence score
Color swatches (if color)
ΔE value (if proximity match)
Designer options per match:
Accept (use suggested match)
Pick Manually (browse variables)
Skip (use fallback)
Save approved mappings to cache
Example Dialog:
Review Variable Matches (5 matches need approval)

Match 1:
Looking for: colors/blue/500
Best match: brand-primary (75% confident)
Color preview: [#3B82F6] vs [#0ea5e9]
Color difference: ΔE = 4.2 (perceptible but acceptable)

[✓ Use this] [🔍 Pick different] [⊗ Skip]

Match 2:
Looking for: spacing/4
Best match: space-md (70% confident)

[✓ Use this] [🔍 Pick different] [⊗ Skip]

[Approve All >70%] [Review Each]
Step 6: Caching
Duration: <100ms to save
What Gets Cached:
Component fingerprints (all analysis results)
Variable inventory (all variables with mappings)
Approved mappings (designer-approved matches)
File version (to detect when cache is stale)
Timestamp (for expiration)
Cache Storage:
Location: Figma's clientStorage API
Scope: Per-file (doesn't transfer between files)
Size: ~1-5 MB depending on file size
TTL: 24 hours
Cache Invalidation:
File version changes (component added/modified)
Designer manually clicks "Rescan"
Cache expires (24 hours old)
Plugin detects significant structural change
Performance Impact:
First scan: 8-15 seconds (200 components)
Cached load: <100ms
100x faster with cache
4.3 Fingerprinting Accuracy
Expected Accuracy:
Semantic role detection: 85-90%
Property mapping: 80-85%
Variable exact match: 95%
Variable semantic match: 75-80%
Variable proximity match (color): 70-80%
Factors Affecting Accuracy:
Component naming conventions (good names = higher accuracy)
Variable naming (semantic names = higher accuracy)
File organization (clean structure = higher accuracy)
Component complexity (simple = higher accuracy)
When Accuracy is Lower:
Custom/unusual naming conventions
Non-standard component structures
Missing variables (forces fallback)
Very large files (sampling may miss patterns)
4.4 Discovery Service Output
Final Output Structure:
DiscoveryData {
  components: [
    {
      id: string
      name: string
      semanticRole: string (inferred)
      confidence: number
      propertyMappings: [
        {
          clientProperty: string
          semanticProperty: string
          valueMappings: [
            {
              clientValue: string
              semanticValue: string
              confidence: number
            }
          ]
        }
      ]
      anatomy: {
        hasIcon: boolean
        hasLabel: boolean
        hasImage: boolean
        structureHash: string
      }
    }
  ],
  variables: [
    {
      collection: string
      name: string
      type: string
      value: any
      scopes: string[]
      semanticMapping: {
        semanticToken: string
        confidence: number
        matchMethod: 'exact' | 'semantic' | 'proximity'
      }
    }
  ],
  approvedMappings: Map<string, string>,
  scanCompletedAt: string,
  fileVersion: string
}
This discovery data is then used by the Resolution Service to map RSNT nodes to actual client assets.
5. Resolution Service: 5-Tier Fallback Hierarchy
5.1 Purpose & Responsibility
The Resolution Service is the critical bridge between semantic RSNT nodes and actual Figma implementations. It answers the fundamental question: "How do we create this semantic element given what's available in the client's file?"
Core Responsibility: For each RSNT node, determine the best strategy to realize it in Figma, choosing from library components, custom construction, or fallback values.
Key Challenge: The same semantic node (e.g., "PrimaryButton") must be creatable in files with:
Full component libraries (Shadcn, Material, etc.)
Partial component libraries (only some components)
No component library (build everything from scratch)
Missing design tokens (use fallback values)
Solution: A 5-tier fallback hierarchy that gracefully degrades from ideal to acceptable.
5.2 The 5-Tier Fallback Hierarchy
The system attempts each tier in sequence until one succeeds. Higher tiers produce better results but require more client assets.
┌─────────────────────────────────────────────────────────┐
│ Tier 1: Library Exact Match                             │
│ Best Result | Highest Requirements                       │
│                                                          │
│ Use client's actual component from library               │
│ Requires: Matching component with mappable properties    │
└────────────────────────┬────────────────────────────────┘
                         │ ❌ Failed
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Tier 2: Structural Match                                │
│ Good Result | Medium Requirements                        │
│                                                          │
│ Use structurally similar "base" component                │
│ Requires: Generic component with right layout            │
└────────────────────────┬────────────────────────────────┘
                         │ ❌ Failed
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Tier 3: Semantic Variable Fallback                      │
│ Acceptable Result | Low Requirements                     │
│                                                          │
│ Build from scratch using client's design tokens          │
│ Requires: 70%+ of variables with high confidence         │
└────────────────────────┬────────────────────────────────┘
                         │ ❌ Failed
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Tier 4: Primitive Fallback                              │
│ Degraded Result | Minimal Requirements                   │
│                                                          │
│ Build using closest raw values found in file             │
│ Requires: Some colors/dimensions exist in file           │
│ Warning: "USING_RAW_VALUES"                              │
└────────────────────────┬────────────────────────────────┘
                         │ ❌ Failed
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Tier 5: System Default                                  │
│ Fallback Result | No Requirements                        │
│                                                          │
│ Build using hardcoded Tailwind defaults                  │
│ Requires: Nothing (always succeeds)                      │
│ Warning: "TOKEN_REQUIRED"                                │
└─────────────────────────────────────────────────────────┘
5.3 Tier 1: Library Exact Match
5.3.1 Goal
Use the client's actual component from their library, with properly mapped properties.
5.3.2 Requirements
Component exists with matching semantic role
Component properties can be mapped to RSNT props
Mapping confidence ≥ 70% for all required props
5.3.3 Process
Step 1: Component Lookup
Input: RSNT node with semanticRole "PrimaryButton"

Lookup in Discovery Data:
- Search component fingerprints for role "Button"
- Found: Component "Button" (confidence 0.9)
- Component has variants:
  - Property "Type": [Filled, Outline, Ghost]
  - Property "Size": [Small, Default, Large]
Step 2: Property Mapping
RSNT Props:
- variant: "primary"
- size: "md"

Component Property Mappings (from Discovery):
- "variant" → "Type" property
  - "primary" → "Filled" (confidence 0.9)
- "size" → "Size" property
  - "md" → "Default" (confidence 0.95)

Mapping Result:
- Type = Filled ✓
- Size = Default ✓
- All props mapped successfully
Step 3: Validation
Check mapping completeness:
- Required props: variant, size
- Mapped successfully: 2/2 (100%)
- Minimum threshold: 70%
- Result: PASS ✓

Check mapping confidence:
- variant mapping: 0.9
- size mapping: 0.95
- Average confidence: 0.925
- Minimum threshold: 0.7
- Result: PASS ✓
Step 4: Resolution Decision
Decision: Use Tier 1 (Library Exact Match)

Execution Instructions:
{
  type: "INSTANTIATE_COMPONENT",
  componentId: "12345:67890",
  properties: {
    "Type": "Filled",
    "Size": "Default"
  },
  constraints: {
    width: "hug",
    height: "hug"
  },
  metadata: {
    tier: 1,
    confidence: 0.925
  }
}
5.3.4 Success Criteria
✅ Component found
✅ All required props mapped (≥70%)
✅ Mapping confidence acceptable (≥0.7)
✅ Component structure compatible
5.3.5 Failure Scenarios
❌ No component with matching semantic role
❌ Component properties incompatible (<70% mappable)
❌ Component structure too different (can't override safely)
❌ Low mapping confidence (<0.7)
When Failed: Proceed to Tier 2
5.4 Tier 2: Structural Match
5.4.1 Goal
Use a structurally similar generic component as a base and override its content.
5.4.2 Requirements
Component exists with matching layout primitive
Component is designed to be flexible (slot/base pattern)
Component can accept content overrides
5.4.3 Process
Step 1: Structure Lookup
Input: RSNT node with layoutPrimitive "stack-h-center"

Search for components with:
- Auto Layout: HORIZONTAL
- Alignment: CENTER (both axes)
- Flexibility: Can accept child overrides

Found: "Base/Horizontal-Center" component
- Layout matches: ✓
- Designed as slot: ✓
- Accepts overrides: ✓
Step 2: Override Planning
RSNT specifies:
- Label: "Submit"
- Background: bg-primary
- Padding: px-4 py-2

Override Strategy:
1. Instantiate Base/Horizontal-Center
2. Replace placeholder text with "Submit"
3. Apply bg-primary fill (resolve to variable)
4. Set padding to 16px/8px
Step 3: Compatibility Check
Check if overrides will work:
- Text content: Replaceable ✓
- Background color: Can bind variable ✓
- Padding: Can modify ✓
- Won't break component: ✓
Step 4: Resolution Decision
Decision: Use Tier 2 (Structural Match)

Execution Instructions:
{
  type: "INSTANTIATE_COMPONENT",
  componentId: "base-h-center-12345",
  overrides: {
    textContent: "Submit",
    fills: [{ type: "VARIABLE", variableId: "primary-var-id" }],
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 8
  },
  metadata: {
    tier: 2,
    confidence: 0.7
  }
}
5.4.4 Success Criteria
✅ Structurally matching component found
✅ Component supports overrides
✅ Overrides won't break component
5.4.5 Failure Scenarios
❌ No component with matching structure
❌ Component is too rigid (no override support)
❌ Overrides would break component functionality
When Failed: Proceed to Tier 3
5.5 Tier 3: Semantic Variable Fallback
5.5.1 Goal
Build frame from scratch using client's design tokens (variables) to match their visual style.
5.5.2 Requirements
≥70% of Tailwind classes can be resolved to client variables
Variable mappings have confidence ≥0.8
5.5.3 Process
Step 1: Class Resolution
Input: RSNT tailwindClasses
["px-4", "py-2", "bg-primary", "rounded-md", "text-primary-foreground"]

Resolve each class to variable:

px-4 (16px):
- Lookup semantic token: "spacing/4"
- Discovery mapping: "spacing-md" (confidence 0.9)
- Variable ID: "var-123"
- Status: RESOLVED ✓

py-2 (8px):
- Lookup semantic token: "spacing/2"
- Discovery mapping: "spacing-sm" (confidence 0.85)
- Variable ID: "var-124"
- Status: RESOLVED ✓

bg-primary:
- Lookup semantic token: "colors/primary"
- Discovery mapping: "brand-primary" (confidence 1.0)
- Variable ID: "var-125"
- Status: RESOLVED ✓

rounded-md (6px):
- Lookup semantic token: "radius/md"
- Discovery mapping: "radius-default" (confidence 0.8)
- Variable ID: "var-126"
- Status: RESOLVED ✓

text-primary-foreground:
- Lookup semantic token: "colors/primary-foreground"
- Discovery mapping: "text-on-primary" (confidence 0.9)
- Variable ID: "var-127"
- Status: RESOLVED ✓

Resolution Summary:
- Total classes: 5
- Resolved: 5 (100%)
- Average confidence: 0.89
- Threshold: 70% with conf ≥0.8
- Result: PASS ✓
Step 2: Frame Construction
Build frame with:
- Auto Layout: HORIZONTAL (from layoutPrimitive)
- Alignment: CENTER, CENTER
- Padding: bound to var-123 (left/right), var-124 (top/bottom)
- Fill: bound to var-125
- Corner radius: bound to var-126
- Text fill: bound to var-127

All properties use variables → Scales with design system
Step 3: Resolution Decision
Decision: Use Tier 3 (Semantic Variable Fallback)

Execution Instructions:
{
  type: "CREATE_FRAME",
  layoutMode: "HORIZONTAL",
  primaryAxisAlignItems: "CENTER",
  counterAxisAlignItems: "CENTER",
  paddingLeft: { type: "VARIABLE", id: "var-123" },
  paddingRight: { type: "VARIABLE", id: "var-123" },
  paddingTop: { type: "VARIABLE", id: "var-124" },
  paddingBottom: { type: "VARIABLE", id: "var-124" },
  fills: [{ type: "VARIABLE", id: "var-125" }],
  cornerRadius: { type: "VARIABLE", id: "var-126" },
  children: [
    {
      type: "TEXT",
      characters: "Submit",
      fills: [{ type: "VARIABLE", id: "var-127" }]
    }
  ],
  metadata: {
    tier: 3,
    confidence: 0.89,
    variablesBound: 5
  }
}
5.5.4 Success Criteria
✅ ≥70% of classes resolved to variables
✅ Variable mapping confidence ≥0.8
✅ All required styling achievable with variables
5.5.5 Failure Scenarios
❌ <70% of classes resolved
❌ Low mapping confidence (<0.8)
❌ Critical variables missing (e.g., no primary color)
When Failed: Proceed to Tier 4
5.6 Tier 4: Primitive Fallback
5.6.1 Goal
Build frame using the closest raw values (hex colors, numeric sizes) found anywhere in the file.
5.6.2 Requirements
Some colors exist in file (from any source)
Some numeric values exist (padding, sizing)
Always succeeds with whatever is available
5.6.3 Process
Step 1: Proximity Search
Input: Need bg-primary color (#3B82F6 in Tailwind)

Search entire file for colors:
- Component fills
- Style fills
- Variable values
- Raw hex values

Found colors in file:
- #0ea5e9 (used in 15 components)
- #3b7bc8 (used in 3 components)
- #1e40af (used in 2 components)

Calculate color distance to target (#3B82F6):
- #0ea5e9: ΔE = 12.3 (moderate difference)
- #3b7bc8: ΔE = 3.8 (close)
- #1e40af: ΔE = 18.5 (very different)

Best match: #3b7bc8 (ΔE = 3.8)
Usage frequency: 3 components (low but acceptable)
Step 2: Value Extraction
For each required property, find closest value:

Padding (need 16px):
- Found in file: 16px (used in 45 places)
- Exact match: ✓

Border radius (need 6px):
- Found in file: 4px (20 uses), 8px (35 uses)
- Closest: 8px
- Approximate match: ⚠️

Text color (need white):
- Found: #ffffff (used in 12 places)
- Exact match: ✓
Step 3: Warning Generation
Issues detected:
1. Using raw hex color (not variable)
2. Border radius approximated (8px instead of 6px)
3. No semantic tokens used

Warnings to show designer:
- "USING_RAW_VALUES: This design uses hardcoded colors and dimensions"
- "Consider adding design tokens for better consistency"
- "Border radius approximated: using 8px (closest available) instead of 6px"
Step 4: Resolution Decision
Decision: Use Tier 4 (Primitive Fallback)

Execution Instructions:
{
  type: "CREATE_FRAME",
  layoutMode: "HORIZONTAL",
  primaryAxisAlignItems: "CENTER",
  counterAxisAlignItems: "CENTER",
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 8,
  paddingBottom: 8,
  fills: [{ type: "SOLID", color: { r: 0.23, g: 0.48, b: 0.78 } }], // #3b7bc8
  cornerRadius: 8, // Approximated
  children: [
    {
      type: "TEXT",
      characters: "Submit",
      fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }]
    }
  ],
  metadata: {
    tier: 4,
    confidence: 0.5,
    warnings: ["USING_RAW_VALUES", "RADIUS_APPROXIMATED"]
  }
}
5.6.4 Success Criteria
✅ Some colors found in file
✅ Some dimensions found in file
✅ Can construct visual approximation
5.6.5 Failure Scenarios
Practically never fails (always some values in file)
Worst case: Use Tier 5 defaults
When Failed: Proceed to Tier 5
5.7 Tier 5: System Default
5.7.1 Goal
Absolute fallback using hardcoded Tailwind default values.
5.7.2 Requirements
None (always succeeds)
5.7.3 Process
Step 1: Default Value Lookup
Use Tailwind's default palette and scale:

bg-primary → #3B82F6 (Tailwind blue-500)
px-4 → 16px (Tailwind spacing scale)
py-2 → 8px
rounded-md → 6px
text-primary-foreground → #FFFFFF

All values from Tailwind defaults
No connection to client's design system
Step 2: Warning Generation
Critical warnings:
- "TOKEN_REQUIRED: This design uses generic values"
- "Not connected to your design system"
- "Add variables/components for proper theming"
- "Background color: #3B82F6 (Tailwind default, not your brand)"
Step 3: Resolution Decision
Decision: Use Tier 5 (System Default)

Execution Instructions:
{
  type: "CREATE_FRAME",
  layoutMode: "HORIZONTAL",
  primaryAxisAlignItems: "CENTER",
  counterAxisAlignItems: "CENTER",
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 8,
  paddingBottom: 8,
  fills: [{ type: "SOLID", color: { r: 0.23, g: 0.51, b: 0.96 } }], // #3B82F6
  cornerRadius: 6,
  children: [
    {
      type: "TEXT",
      characters: "Submit",
      fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }]
    }
  ],
  metadata: {
    tier: 5,
    confidence: 0.3,
    warnings: ["TOKEN_REQUIRED", "USING_DEFAULTS"]
  }
}
5.7.4 Success Criteria
✅ Always succeeds
5.7.5 Designer Impact
Designer sees prominent warnings:
Large warning banner on generated element
"This element needs design tokens"
Link to add variables/components
Offer to show Discovery process
5.8 Resolution Decision Matrix
5.8.1 Quick Reference Table
Scenario
Tier Used
Quality
Designer Action
Full component library + variables
1
⭐⭐⭐⭐⭐
None needed
Partial library, good variables
2-3
⭐⭐⭐⭐
Optional improvements
No library, some variables
3
⭐⭐⭐
Consider adding components
Minimal setup, some colors
4
⭐⭐
Add variables
Empty file
5
⭐
Set up design system

5.8.2 Tier Distribution (Expected)
Well-Maintained Files (80% of usage):
Tier 1: 70%
Tier 2: 15%
Tier 3: 10%
Tier 4: 4%
Tier 5: 1%
New/Minimal Files (20% of usage):
Tier 1: 20%
Tier 2: 10%
Tier 3: 20%
Tier 4: 30%
Tier 5: 20%
5.9 Component Property Mapping Details
5.9.1 The Mapping Challenge
RSNT uses standardized semantic properties (variant, size, state), but client components use diverse naming:
Examples of real-world diversity:
Variant: "Type", "Variant", "Style", "Appearance", "Kind", "Emphasis"
Size: "Size", "Scale", "Dimension", "Height", "Compact"
State: "State", "Status", "Mode", "Interaction"
5.9.2 Semantic Matching Algorithm
Step 1: Property Classification
For each component property, classify its semantic type:

Component property "Emphasis" with values ["High", "Medium", "Low"]

AI Analysis:
- Property name: "Emphasis" suggests importance/priority
- Values: Ordered by intensity (High > Medium > Low)
- Classification: SEMANTIC_VARIANT
- Confidence: 0.85

Component property "Scale" with values ["Compact", "Regular", "Spacious"]

AI Analysis:
- Property name: "Scale" suggests size
- Values: Ordered by size (Compact < Regular < Spacious)
- Classification: SEMANTIC_SIZE
- Confidence: 0.9
Step 2: Value Mapping
Map RSNT semantic values to component values:

RSNT: variant="primary"
Component: Property="Emphasis", Values=["High", "Medium", "Low"]

Mapping strategy:
1. Exact match: "primary" in values? No
2. Semantic match: AI suggests:
   - "primary" (importance/emphasis) → "High" (most emphatic)
   - Confidence: 0.85
3. Result: Map "primary" → "High"

RSNT: size="md"
Component: Property="Scale", Values=["Compact", "Regular", "Spacious"]

Mapping strategy:
1. Exact match: "md" in values? No
2. Semantic match: AI suggests:
   - "md" (medium) → "Regular" (middle option)
   - Confidence: 0.9
3. Result: Map "md" → "Regular"
Step 3: Fuzzy String Matching (fallback)
If AI semantic matching fails, try string similarity:

RSNT: variant="primary"
Component values: ["Main", "Primary", "Secondary"]

String matching:
- "primary" vs "Main": similarity 0.2
- "primary" vs "Primary": similarity 1.0 (case-insensitive exact)
- "primary" vs "Secondary": similarity 0.3

Best match: "Primary" (similarity 1.0)
Confidence: 0.95
5.9.3 Handling Unmapped Properties
Scenario: RSNT has props that can't be mapped
Example:
RSNT Props:
- variant: "primary" → Mapped ✓
- size: "md" → Mapped ✓
- emphasis: "high" → No matching component property ❌

Component Properties:
- Type: [Filled, Outline]
- Size: [Small, Default, Large]
(No "emphasis" property)

Decision Logic:
1. Calculate mapping completeness: 2/3 = 66.7%
2. Check threshold: 70% required
3. Result: Below threshold

Option A: Fail Tier 1, try Tier 2
Option B: Accept with warning (if close to threshold)

Chosen: Option A (strict compliance)
Warning to designer: "Couldn't map 'emphasis' property"
5.9.4 Handling Extra Component Properties
Scenario: Component has properties RSNT doesn't specify
Example:
RSNT Props:
- variant: "primary"
- size: "md"
(No "state" specified)

Component Properties:
- Type: [Filled, Outline]
- Size: [Small, Default, Large]
- State: [Default, Hover, Pressed, Disabled]

Decision:
1. Map specified props: Type=Filled, Size=Default
2. For unmapped props, use component's default value
3. State: Leave as "Default" (component default)

Result: Partial property setting (common and acceptable)
5.10 Resolution Service API
5.10.1 Input Interface
interface ResolutionInput {
  rsntNode: RSNT_Node
  discoveryData: DiscoveryData
  presetRules?: PresetConfig
  parentContext?: {
    parentNodeId: string
    availableSpace: { width: number, height: number }
  }
}
5.10.2 Output Interface
interface ResolutionResult {
  success: boolean
  tier: 1 | 2 | 3 | 4 | 5
  method: 'library-component' | 'structural-match' | 'variable-construction' 
         | 'primitive-fallback' | 'system-default'
  instructions: ExecutionInstructions
  warnings?: string[]
  conflicts?: Conflict[]
  metadata: {
    confidence: number
    processingTime: number
    fallbackReason?: string
  }
}

interface ExecutionInstructions {
  type: 'INSTANTIATE_COMPONENT' | 'CREATE_FRAME'
  // ... specific fields per type
}
5.10.3 Performance Characteristics
Tier 1 check: 10-20ms (database lookup + mapping)
Tier 2 check: 5-10ms (structure matching)
Tier 3 check: 20-50ms (variable resolution for all classes)
Tier 4 check: 50-100ms (proximity search across file)
Tier 5: <1ms (immediate fallback)
Caching Strategy:
Cache successful resolutions per RSNT node type
Cache duration: Session-based (cleared after generation)
Hit rate target: >80% for repeated node types

6. Orchestration Service: The AI Brain
6.1 Purpose & Responsibility
The Orchestration Service is where human intent meets machine structure. It's the "compiler frontend" that translates natural language into the strictly typed RSNT format.
Core Responsibility: Parse user intent and generate valid RSNT JSON using only approved semantic roles, layout primitives, and Tailwind classes.
Critical Constraint: The AI must NOT design — it must ONLY translate intent into structure using pre-defined vocabulary.
6.2 AI Role Definition
6.2.1 What AI Does
1. Intent Parsing
Extract key requirements from natural language
Identify component types needed
Understand hierarchical relationships
Recognize constraints and preferences
2. Semantic Role Selection
Choose appropriate roles from approved list
Select based on function, not appearance
Consider context and relationships
3. Layout Primitive Selection
Choose structural patterns from standard library
Based on described arrangement
Consider responsive behavior needs
4. Tailwind Class Application
Select utility classes from reference
Apply spacing, sizing, styling
Follow preset rules if applicable
5. Tree Structure Construction
Build parent-child relationships
Determine nesting depth
Order siblings logically
6. Confidence Self-Assessment
Calculate certainty in interpretation
Identify ambiguities
Flag areas needing clarification
6.2.2 What AI Does NOT Do
1. Design Decisions
❌ Choose colors (applies semantic tokens)
❌ Invent spacing (uses Tailwind scale)
❌ Create custom layouts (uses primitives)
❌ Make aesthetic choices
2. Hallucination
❌ Create new semantic roles
❌ Invent layout primitives
❌ Use invalid Tailwind classes
❌ Add properties not in schema
3. Subjective Interpretation
❌ Interpret "beautiful" or "modern"
❌ Apply personal style preferences
❌ Make brand-specific assumptions
6.2.3 Enforcement Mechanisms
Mechanism 1: Explicit Vocabulary Lists System prompt includes complete lists of:
All approved semantic roles (50+)
All approved layout primitives (20+)
Tailwind class reference (grouped by category)
AI can ONLY choose from these lists.
Mechanism 2: Schema Validation Every AI output is validated against RSNT schema. Invalid output rejected, AI prompted to retry.
Mechanism 3: Confidence Scoring AI must provide confidence score (0-1). Low confidence triggers clarification flow.
Mechanism 4: Explanation Requirement AI must explain its decisions. Helps detect hallucinations or errors.
6.3 Prompt Architecture
6.3.1 System Prompt Structure
The system prompt is carefully engineered to constrain and guide the AI:
Part 1: Role Definition (100 words)
You are a Semantic Design Compiler. Your role is to translate user intent 
into structured RSNT JSON. You NEVER design — you only translate intent using 
approved semantic roles, layout primitives, and Tailwind classes.

CRITICAL: You must only use elements from the provided approved lists. Any 
use of unapproved roles, primitives, or invalid Tailwind classes will cause 
validation failure.
Part 2: Rules & Constraints (200 words)
MANDATORY RULES:
1. Output MUST be valid JSON matching the RSNT schema exactly
2. Use ONLY approved Semantic Roles (list provided below)
3. Use ONLY approved Layout Primitives (list provided below)
4. Use ONLY valid Tailwind CSS utility classes (reference provided below)
5. DO NOT invent or hallucinate any component properties
6. DO NOT make subjective design decisions
7. ALWAYS include confidence score (0-1) in metadata
8. ALWAYS provide brief explanation of key decisions

SCHEMA REQUIREMENTS:
- Every node needs: id, semanticRole, layoutPrimitive, tailwindClasses, props, children, constraints, metadata
- IDs must be unique
- Props must match semantic role expectations
- Constraints must specify width and height behavior
Part 3: Approved Vocabulary (1000+ words)
APPROVED SEMANTIC ROLES:
Layout Containers: Page, Section, Container, Card, Panel, Wrapper, Group, Stack
Form Elements: Form, FormField, FormGroup, Input, TextArea, Select, Checkbox, Radio, Switch, Label
Buttons: PrimaryButton, SecondaryButton, GhostButton, DestructiveButton, IconButton, ButtonGroup
Navigation: Nav, NavItem, NavLink, Breadcrumb, Tabs, TabsList, TabsTrigger, TabsContent
Typography: Heading, Subheading, Paragraph, Caption, Label, Code, Link
Feedback: Alert, Toast, Badge, Spinner, Progress, Skeleton
Overlays: Dialog, Sheet, Popover, Tooltip, DropdownMenu
Data: Table, TableRow, TableCell, List, ListItem, Avatar
[Complete list of 50+ roles]

APPROVED LAYOUT PRIMITIVES:
Flex Layouts: stack-v, stack-v-start, stack-v-center, stack-h, stack-h-center, 
              flex-center-both, flex-space-between, flex-wrap
Grid Layouts: grid-2-col, grid-3-col, grid-4-col, grid-auto-fill, grid-responsive
Special: inset-square, full-bleed, constrained-center, sidebar-layout, sticky-header
[Complete list of 20+ primitives with descriptions]

TAILWIND CLASS REFERENCE:
Spacing: p-{0-96}, px-{}, py-{}, pt-{}, pr-{}, pb-{}, pl-{}, 
         m-{0-96}, mx-{}, my-{}, gap-{0-96}
Sizing: w-{0-96,auto,full,screen,fit}, h-{0-96,auto,full,screen,fit}, 
        min-w-{}, max-w-{}, min-h-{}, max-h-{}
Layout: flex, flex-col, flex-row, grid, grid-cols-{1-12}, items-{start,center,end}, 
        justify-{start,center,end,between}
Colors: bg-{color}, text-{color}, border-{color} where color includes: 
        primary, secondary, destructive, muted, accent, or semantic tokens
Borders: border, border-{0-8}, rounded-{none,sm,md,lg,xl,2xl,full}
Typography: text-{xs,sm,base,lg,xl,2xl-9xl}, font-{thin-black}, 
            leading-{none,tight,normal,relaxed,loose}
[Complete Tailwind reference organized by category]
Part 4: Current Context (200-500 words, dynamic)
CURRENT PRESET: Shadcn UI v1.3.0

Preset-Specific Rules:
- Button height: h-10 (40px)
- Input height: h-10 (40px)
- Card padding: p-6 (24px)
- Border radius: rounded-md (6px from --radius variable)
- Spacing scale: Standard Tailwind scale
- Form field gap: gap-2 (8px)

Creator's Rules (Your Design Patterns):
- Form layouts: Vertical stack, gap-4 between fields
- Button groups: Vertical stack, gap-2 between buttons
- Cards: Max-width 400-600px, centered on mobile
- Error alerts: Destructive variant, show below relevant field
- Loading states: Show spinner, disable interactivity

Client File Context:
- Available components: Button, Input, Card, Label, Alert (Shadcn-based)
- Design tokens: Primary, secondary, destructive, muted colors available
- Layout: Supports Auto Layout, responsive design
Part 5: Response Format (200 words)
OUTPUT FORMAT:
Return ONLY valid JSON. No markdown formatting, no explanation text outside JSON.

Required structure:
{
  "rsnt": { /* RSNT_Node object */ },
  "confidence": 0.85, // Your confidence (0-1) in this interpretation
  "explanation": "Brief explanation of key decisions",
  "ambiguities": ["Any unclear aspects of the intent"],
  "assumptions": ["Any assumptions made"]
}

Example output:
{
  "rsnt": {
    "id": "card-001",
    "semanticRole": "Card",
    "layoutPrimitive": "stack-v",
    "tailwindClasses": ["p-6", "gap-4", "max-w-md"],
    "props": {},
    "children": [ /* child nodes */ ],
    "constraints": { "width": "fixed", "height": "hug", "maxWidth": 400 },
    "metadata": {
      "source": "ai",
      "ruleVersion": "1.0.0",
      "presetUsed": "shadcn-v1.3.0",
      "createdAt": "2026-01-27T10:30:00Z",
      "confidence": 0.92
    }
  },
  "confidence": 0.92,
  "explanation": "Created login card with standard form layout following Shadcn patterns",
  "ambiguities": [],
  "assumptions": ["Used email and password fields as most common for login"]
}
6.3.2 User Message Structure
The user message contains the actual intent plus context:
Template:
USER INTENT: {intent}

ADDITIONAL CONTEXT:
{context}

Translate this into an RSNT JSON object following all rules above.
Example 1: Simple Intent
USER INTENT: Create a primary button that says "Submit"

ADDITIONAL CONTEXT:
- Platform: web
- Size: medium

Translate this into an RSNT JSON object following all rules above.
Example 2: Complex Intent
USER INTENT: Create a login card with email and password fields, 
error alert, and two buttons (submit and forgot password link)

ADDITIONAL CONTEXT:
- Platform: web
- Preset: Shadcn UI
- Constraints: max-width 400px, comfortable spacing
- Required: Email and password must be required fields
- Optional: Include "Remember me" checkbox if it makes sense

Translate this into an RSNT JSON object following all rules above.
Example 3: Ambiguous Intent (Tests Clarification)
USER INTENT: Make a friendly card for onboarding

ADDITIONAL CONTEXT:
- Platform: web
- Target users: new signups

Translate this into an RSNT JSON object following all rules above.
6.4 Confidence Scoring System
6.4.1 Confidence Calculation
The system calculates confidence based on multiple factors:
Factor 1: Validation Errors (weight 0.3)
Base: 1.0
Penalties:
- Critical error (invalid role/primitive): -0.3 per error
- Warning (unusual pattern): -0.1 per warning
- Missing recommended prop: -0.05 per prop

Example:
- 0 errors: factor = 1.0
- 1 critical error: factor = 0.7
- 2 warnings: factor = 0.8
Factor 2: Ambiguity (weight 0.2)
Detected ambiguities reduce confidence:
- Vague layout terms ("centered" without axis specified): -0.1
- Missing key requirements (no size specified): -0.05
- Subjective terms ("friendly", "modern"): -0.15

Example:
- Intent: "Create a button" (clear): factor = 1.0
- Intent: "Create a friendly button" (subjective): factor = 0.85
- Intent: "Create a centered card" (ambiguous): factor = 0.9
Factor 3: Complexity Match (weight 0.25)
Compare intent complexity to RSNT complexity:

Intent Complexity Score:
- Word count / 10
- Number of requirements
- Specificity (vague = low, specific = high)

RSNT Complexity Score:
- Node count / 10
- Nesting depth
- Number of props specified

Complexity Ratio = min(intentComplexity, rsntComplexity) / max(...)

Example:
- Simple intent → Simple RSNT: ratio = 1.0 (perfect)
- Simple intent → Complex RSNT: ratio = 0.5 (over-complicated)
- Complex intent → Simple RSNT: ratio = 0.6 (under-delivered)
Factor 4: Unknown Elements (weight 0.15)
Using unknown or less common elements reduces confidence:
- Unknown semantic role: -0.2 per role
- Uncommon layout primitive: -0.1 per primitive
- Custom/edge-case Tailwind class: -0.05 per class

Example:
- All standard elements: factor = 1.0
- 1 uncommon primitive: factor = 0.9
- 1 unknown role: factor = 0.8
Factor 5: Nesting Depth (weight 0.1)
Excessive nesting suggests confusion or over-engineering:
- Depth 1-3: factor = 1.0
- Depth 4-5: factor = 0.95
- Depth 6-7: factor = 0.85
- Depth 8+: factor = 0.7

Example:
- Button (depth 1): factor = 1.0
- Login card (depth 4): factor = 0.95
- Over-nested (depth 8): factor = 0.7
Combined Confidence Score:
confidence = (
  validationFactor * 0.3 +
  ambiguityFactor * 0.2 +
  complexityMatchFactor * 0.25 +
  unknownElementsFactor * 0.15 +
  nestingFactor * 0.1
)

Floor: 0.3 (even perfect scores have some AI uncertainty)
Ceiling: 1.0
6.4.2 Confidence Examples
Example 1: High Confidence (0.95)
Intent: "Create a primary button that says 'Submit' with medium size"

Factors:
- Validation: 1.0 (no errors)
- Ambiguity: 1.0 (very clear intent)
- Complexity match: 1.0 (simple → simple)
- Unknown elements: 1.0 (all standard)
- Nesting: 1.0 (depth 1)

Result: 0.95 confidence (high, auto-execute)
Example 2: Medium Confidence (0.78)
Intent: "Create a card with some fields for user info"

Factors:
- Validation: 1.0 (no errors)
- Ambiguity: 0.7 ("some fields" is vague)
- Complexity match: 0.8 (underspecified intent)
- Unknown elements: 1.0 (all standard)
- Nesting: 0.95 (depth 4)

Result: 0.78 confidence (medium, show preview)
Example 3: Low Confidence (0.45)
Intent: "Make a really cool modern dashboard thing"

Factors:
- Validation: 0.9 (1 warning for vague structure)
- Ambiguity: 0.3 ("cool", "modern", "thing" all vague)
- Complexity match: 0.5 (intent unclear, RSNT guessed)
- Unknown elements: 0.9 (assumed some elements)
- Nesting: 0.8 (depth 6, complex guess)

Result: 0.45 confidence (low, request clarification)
6.5 AI Response Processing
6.5 Confidence Scoring System
The system calculates a confidence score (0-1) based on multiple factors.
6.5.1 Confidence Factors
Factor 1: Validation Success (Base)
if (all validation passed) {
  baseConfidence = 1.0
} else if (minor warnings) {
  baseConfidence = 0.8
} else {
  baseConfidence = 0.3
}
Factor 2: Ambiguity Penalty (-0.1 per issue)
Ambiguous patterns detected:
- Using generic layout primitive (stack-v instead of stack-v-start)
- Missing specific sizing (no maxWidth when width=fixed)
- Vague semantic role (Container instead of Card)

confidencePenalty = ambiguityCount * 0.1
Factor 3: Complexity Mismatch (-0.15 max)
intentComplexity = estimateIntentComplexity(userIntent)
rsntComplexity = estimateRSNTComplexity(generatedRSNT)

mismatchPenalty = abs(intentComplexity - rsntComplexity) / max(intentComplexity, rsntComplexity) * 0.15
Factor 4: Unknown Elements Penalty (-0.2 per element)
unknownRoles = count roles not in approved list
unknownPrimitives = count primitives not in approved list

unknownPenalty = (unknownRoles + unknownPrimitives) * 0.2
Factor 5: Excessive Nesting Penalty (-0.05 per level beyond 4)
depth = calculateMaxDepth(rsnt)
if (depth > 4) {
  nestingPenalty = (depth - 4) * 0.05
}
Final Confidence Calculation:
finalConfidence = baseConfidence 
                - ambiguityPenalty 
                - mismatchPenalty 
                - unknownPenalty 
                - nestingPenalty

// Floor at 0.3, ceiling at 1.0
finalConfidence = Math.max(0.3, Math.min(1.0, finalConfidence))
6.5.2 Confidence-Based Actions
High Confidence (≥ 0.9):
Auto-execute immediately
No designer intervention
Show success notification
Medium Confidence (0.6 - 0.89):
Render ghost preview (semi-transparent)
Show approval dialog with explanation
Allow designer to approve/adjust/reject
Low Confidence (< 0.6):
DO NOT render anything
Show clarification questions
Ask designer for more information
6.5.3 Confidence Score Examples
Example 1: Perfect Generation
User Intent: "Create a primary button"
AI Output: Valid RSNT with PrimaryButton, stack-h-center, all correct

Validation: ✓ Pass
Ambiguity: 0
Complexity Match: Perfect (both simple)
Unknown Elements: 0
Nesting Depth: 1

Confidence: 1.0 - 0 - 0 - 0 - 0 = 1.0 (100%)
Action: Auto-execute
Example 2: Good but Could Be Better
User Intent: "Create a login card"
AI Output: Valid RSNT with Card, Form, 2 FormFields, 2 Buttons

Validation: ✓ Pass
Ambiguity: 1 (used generic "Container" for header)
Complexity Match: Good (reasonable for intent)
Unknown Elements: 0
Nesting Depth: 4

Confidence: 1.0 - 0.1 - 0.02 - 0 - 0 = 0.88 (88%)
Action: Show preview for approval
Example 3: Unclear Intent
User Intent: "Create something cool for my app"
AI Output: Simple Container with heading

Validation: ✓ Pass  
Ambiguity: 2 (very generic structure)
Complexity Match: Poor (intent unclear, output simple)
Unknown Elements: 0
Nesting Depth: 2

Confidence: 1.0 - 0.2 - 0.15 - 0 - 0 = 0.65 (65%)
Action: Show preview
Example 4: Attempted Invalid Output
User Intent: "Create a super fancy animated button"
AI Output: Contains "FancyButton" role (not approved)

Validation: ✗ Fail (unknown role)
Unknown Elements: 1

Confidence: 0.3 (base for validation failure)
Action: Show clarification questions
6.6 Iterative Refinement
When confidence is low, the system asks clarifying questions and regenerates.
6.6.1 Question Generation
Analyze RSNT for ambiguities:
function generateClarifyingQuestions(rsnt: RSNT_Node, intent: string): string[] {
  const questions = [];
  
  // Check for generic layout primitives
  if (hasGenericLayout(rsnt)) {
    questions.push("Should the items be aligned to the start, center, or distributed evenly?");
  }
  
  // Check for unknown semantic roles
  const unknownRoles = findUnknownRoles(rsnt);
  if (unknownRoles.length > 0) {
    questions.push(`I don't have a rule for "${unknownRoles[0]}". Should I use a similar component like "${suggestAlternative(unknownRoles[0])}" instead?`);
  }
  
  // Check if output seems too simple for intent
  if (intentSeemsComplex(intent) && rsntIsSimple(rsnt)) {
    questions.push("Your request seems comprehensive. Did you want additional elements like labels, icons, or descriptions?");
  }
  
  // Check for missing details
  if (missingCriticalDetails(rsnt)) {
    questions.push("Should this have specific sizing or spacing requirements?");
  }
  
  return questions.slice(0, 5); // Max 5 questions
}
6.6.2 Regeneration with Answers
Original Intent: "Create a card"
Confidence: 0.45 (too low)

Clarifying Questions:
1. "What content should be in the card?"
2. "Should it have actions like buttons?"
3. "What's the purpose of this card?"

Designer Answers:
1. "Product information with image, title, price, and description"
2. "Yes, add to cart button"
3. "E-commerce product listing"

Regenerate:
New Intent: Original + Answers
New RSNT: Card with Image, Heading, Paragraph, Price, PrimaryButton
New Confidence: 0.92 (high, auto-execute)
6.7 Offline Mode
When AI is unavailable or disabled, the system falls back to manual rule selection.
Offline Mode UI:
┌─────────────────────────────────────────┐
│ Create Design (Offline Mode)            │
├─────────────────────────────────────────┤
│ Component Type:                          │
│ ○ Button                                 │
│ ○ Card                                   │
│ ○ Form                                   │
│ ● Custom                                 │
│                                          │
│ Layout:                                  │
│ [Dropdown: stack-v ▼]                   │
│                                          │
│ Properties:                              │
│ Label: [Submit___]                      │
│ Variant: [primary ▼]                    │
│ Size: [md ▼]                            │
│                                          │
│         [Generate]                       │
└─────────────────────────────────────────┘
Offline Mode Process:
Designer selects component type from list
Designer configures properties manually
System generates RSNT directly (no AI)
Confidence = 1.0 (designer explicitly chose everything)
Execute normally

[Continuing with remaining sections...]
7. Conflict Resolution Logic
7.1 The Conflict Problem
Conflicts occur when multiple sources specify different values for the same property.
Common Conflict Scenarios:
RSNT says button height h-10 (40px), client component is 44px
Preset says card padding p-6, creator rule says p-4
RSNT says rounded-md (6px), component has 8px radius
Variable binding specifies one color, raw component uses another
Why Conflicts Happen:
Client components have opinionated designs
Presets have specific conventions
Creator rules may not match client's existing patterns
RSNT suggests ideal values that don't exist
7.2 Priority Hierarchy (The Resolution Order)
The system resolves all conflicts using a strict 4-level priority hierarchy:
┌──────────────────────────────────────────────────────────┐
│ PRIORITY 1 (HIGHEST): Component Internal Logic           │
│ What: Client's actual component design                   │
│ Why: Forcing different values breaks component           │
│ Example: Button designed as 44px for accessibility       │
└─────────────────────┬────────────────────────────────────┘
                      │ If no component value exists ↓
┌──────────────────────────────────────────────────────────┐
│ PRIORITY 2: Preset Override Rules                        │
│ What: User-selected preset conventions (Shadcn, Radix)   │
│ Why: User explicitly chose to follow this system         │
│ Example: Shadcn uses specific radius (var(--radius))     │
└─────────────────────┬────────────────────────────────────┘
                      │ If no preset value exists ↓
┌──────────────────────────────────────────────────────────┐
│ PRIORITY 3: Creator's Default Rules                      │
│ What: Plugin creator's defined patterns                  │
│ Why: Default patterns when nothing else specified        │
│ Example: Standard spacing scale, hierarchy patterns      │
└─────────────────────┬────────────────────────────────────┘
                      │ If no creator rule exists ↓
┌──────────────────────────────────────────────────────────┐
│ PRIORITY 4 (LOWEST): System Defaults                     │
│ What: Hardcoded Tailwind values                          │
│ Why: Absolute fallback, always available                 │
│ Example: bg-blue-500 → #3B82F6                           │
└──────────────────────────────────────────────────────────┘
7.2.1 Priority Justifications
Why Component Wins (P1):
Client deliberately designed component this way
Changing component properties can break it functionally
Component may have accessibility/usability reasons
Respects client's design authority
Why Preset Beats Creator Rules (P2 > P3):
User explicitly selected the preset
Indicates intent to follow that system's conventions
Preset is more specific to current context
Designer actively chose this direction
Why Creator Rules Are Default (P3):
Apply when nothing more specific exists
Provide consistent baseline
Can be overridden when needed
Good defaults for most cases
Why System Defaults Are Last (P4):
Only used when nothing else available
Better than failing completely
Flagged for designer attention
Easy to identify and replace
7.3 Conflict Detection Process
Step 1: Collect All Values For each property (height, padding, color, etc.), collect what each source specifies:
Property: button-height
- Component: 44px (if using Tier 1)
- Preset: 40px (if Shadcn selected)
- RSNT: h-10 which means 40px
- Creator Rule: h-10 (40px)
- System Default: h-10 (40px)
Step 2: Identify Disagreement
if (uniqueValues.length > 1) {
  conflict detected
}
Step 3: Apply Priority Hierarchy
if (component has value) {
  winner = component value (P1)
} else if (preset has value) {
  winner = preset value (P2)
} else if (creator rule has value) {
  winner = creator rule (P3)
} else {
  winner = system default (P4)
}
Step 4: Log Conflict
ConflictLog {
  property: 'button-height'
  sources: [
    { source: 'component', value: '44px', priority: 1 },
    { source: 'preset', value: '40px', priority: 2 },
    { source: 'rsnt', value: '40px', priority: 3 }
  ]
  winner: { source: 'component', value: '44px' }
  reason: 'Component internal logic takes precedence (P1)'
}
7.4 Conflict Resolution Examples
Example 1: Button Height
Scenario:
RSNT Node: PrimaryButton
- Tailwind: h-10 (wants 40px)

Client Component: Button
- Actual height: 44px (hardcoded)

Preset: Shadcn
- Convention: h-10 (40px)

Creator Rule: Default button
- Height: h-10 (40px)
Resolution:
Collect values:
- Component: 44px (P1)
- Preset: 40px (P2)
- RSNT: 40px (P3)
- Creator: 40px (P3)

Winner: Component (44px) — Priority 1

Action:
- Remove h-10 class from RSNT
- Use component as-is (44px)
- Log conflict for designer review

Result: Button renders at 44px
Example 2: Card Padding
Scenario:
RSNT Node: Card
- Tailwind: p-8 (32px)

Client Component: Card
- No explicit padding (uses children's spacing)

Preset: Shadcn
- Convention: p-6 (24px)

Creator Rule: Default card
- Padding: p-4 (16px)
Resolution:
Collect values:
- Component: none (no opinion)
- Preset: 24px (P2)
- RSNT: 32px (derived from p-8)
- Creator: 16px (P3)

Winner: Preset (24px) — Priority 2
(Component has no value, so check next priority)

Action:
- Override RSNT p-8 with p-6
- Apply 24px padding

Result: Card renders with 24px padding
Example 3: Border Radius
Scenario:
RSNT Node: Input
- Tailwind: rounded-md (6px)

Client Component: Input
- Corner radius: 8px

Preset: None selected

Creator Rule: Default input
- Radius: rounded-md (6px)
Resolution:
Collect values:
- Component: 8px (P1)
- Preset: none
- RSNT: 6px (P3)
- Creator: 6px (P3)

Winner: Component (8px) — Priority 1

Result: Input renders with 8px radius
Example 4: Color (No Conflict)
Scenario:
RSNT Node: Button
- Tailwind: bg-primary

Client Component: Button
- Uses variable binding to "brand-primary"

Resolution: Discovery mapped bg-primary → brand-primary
No conflict (same semantic meaning)

Result: Button uses brand-primary variable
7.5 Designer Notification & Review
After generation, if conflicts were detected:
Notification:
⚠️ 3 conflicts auto-resolved

Click to review →
Conflict Report (when clicked):
┌──────────────────────────────────────────────────────────┐
│ Conflict Resolution Report                                │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ CONFLICT 1: Button Height                                │
│ Your Rule:     40px (h-10)                               │
│ Component:     44px                                       │
│ Resolution:    Used 44px (Component priority)            │
│ Reason:        Component internal logic takes precedence │
│                                                           │
│ [ This is fine ] [ Always use my rules ] [ Edit component ]
│                                                           │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ CONFLICT 2: Card Padding                                 │
│ Your Rule:     16px (p-4)                                │
│ Shadcn Preset: 24px (p-6)                                │
│ Resolution:    Used 24px (Preset override)               │
│ Reason:        Shadcn preset selected                    │
│                                                           │
│ [ This is fine ] [ Always use my rules ] [ Update preset ]
│                                                           │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ CONFLICT 3: Border Radius                                │
│ Your Rule:     6px (rounded-md)                          │
│ Component:     8px                                        │
│ Resolution:    Used 8px (Component priority)             │
│ Reason:        Component internal logic                  │
│                                                           │
│ [ This is fine ] [ Always use my rules ] [ Edit component ]
│                                                           │
└──────────────────────────────────────────────────────────┘

[Dismiss] [Save Preferences]
7.6 Preference Overrides
Designers can create persistent preferences that override the default priority hierarchy:
Setting a Preference:
Designer clicks: "Always use my rules" for Button.height

System saves preference:
{
  "Button.height": {
    "always": "creator-rules",
    "reason": "Brand standard requires consistent 40px",
    "overridesPriority": true
  }
}

Storage: figma.root.setPluginData('conflict-preferences', JSON.stringify(prefs))
Applying Preference:
Next time Button height conflict occurs:

Check preferences first:
if (preferences['Button.height'] === 'creator-rules') {
  winner = creator rule value (ignores component)
  log: "Using creator rule per designer preference"
}
Preference UI (in Settings):
┌──────────────────────────────────────────────────────────┐
│ Conflict Preferences                                      │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ Button.height: Always use creator rules (40px)           │
│ Reason: Brand standard                                   │
│ [Edit] [Remove]                                          │
│                                                           │
│ Card.shadow: Always use component                        │
│ Reason: Component shadow is better                       │
│ [Edit] [Remove]                                          │
│                                                           │
├──────────────────────────────────────────────────────────┤
│ [Add New Preference]                                      │
└──────────────────────────────────────────────────────────┘
7.7 Conflict Prevention Strategies
Strategy 1: Preset Compatibility Check Before generation, if preset selected:
Check: Do client components match preset conventions?

Shadcn expects:
- Button: h-10 (40px)
- Input: h-10 (40px)
- Card: p-6 (24px)

Client components:
- Button: 44px ⚠️ Mismatch
- Input: 40px ✓ Match
- Card: 24px ✓ Match

Show warning:
"⚠️ Your Button component (44px) differs from Shadcn convention (40px).
This will cause conflicts. Recommended action:
○ Let component win (your design takes priority)
● Let preset win (force Shadcn values) ← Can break component!
○ Don't use Shadcn preset"
Strategy 2: Rule Adaptation Learn from conflicts and adapt rules:
After 5 generations, system notices:
- Button.height conflict every time
- Always resolved to component value (44px)

Suggestion:
"I've noticed your Button component uses 44px, but the rule specifies 40px.
Would you like to update the rule to match your component?"

If yes: Update creator rule to h-11 (44px)
Result: Future generations have no conflict
Strategy 3: Component Flexibility Markup Allow components to declare flexible properties:
Component metadata:
{
  "flexibleProperties": {
    "padding": true,     // OK to override
    "height": false,     // DO NOT override
    "radius": true       // OK to override
  }
}

During resolution:
if (!component.flexibleProperties[property]) {
  // Property is NOT flexible, must use component value
  winner = component value
}

8. Rule Authoring System
8.1 Purpose & Responsibility
The Rule Authoring System enables designers to encode their design expertise as executable rules that guide AI generation.
Core Responsibility: Provide intuitive ways for designers to create, manage, and version rules that define how semantic elements should be structured and styled.
Why It's Critical:
Captures institutional knowledge
Ensures consistency across projects
Enables rapid onboarding of new team members
Allows customization without coding
8.2 Rule Types
8.2.1 Layout Rules
What they define: Structural arrangement of elements
Examples:
Rule: "Form Field Layout"
- Structure: FormField contains Label + Input (vertical stack)
- Spacing: gap-2 between label and input
- Constraints: Fill width, hug height
- Application: Applied whenever FormField semantic role used
8.2.2 Typography Rules
What they define: Text styling and hierarchy
Examples:
Rule: "Heading Hierarchy"
- H1: text-4xl, font-bold, tracking-tight
- H2: text-3xl, font-semibold
- H3: text-2xl, font-semibold
- H4: text-xl, font-medium
- Application: Applied based on heading level prop
8.2.3 Spacing Rules
What they define: Padding, margins, gaps
Examples:
Rule: "Card Spacing"
- Desktop: p-8, gap-6
- Tablet: p-6, gap-4
- Mobile: p-4, gap-3
- Application: Applied to Card semantic role, responsive
8.2.4 Component Composition Rules
What they define: Required/optional child elements
Examples:
Rule: "Login Card Composition"
- Required: Header (with Heading), Form (with 2+ FormFields), Actions (with PrimaryButton)
- Optional: Alert (for errors), Checkbox (remember me)
- Validation: Warns if required elements missing
8.2.5 Hierarchy Rules
What they define: Visual importance and stacking
Examples:
Rule: "Button Hierarchy"
- Page should have max 1 PrimaryButton (main action)
- Secondary buttons unlimited
- Ghost buttons for tertiary actions
- Validation: Warns if multiple PrimaryButtons on same level
8.3 Rule Authoring Methods
8.3.1 Method 1: Record Mode (Primary Method)
Concept: Analyze an existing design to extract rules automatically.
Process:
Step 1: Designer Creates Exemplar
Designer manually creates the "perfect" example in Figma:
- Login card with ideal spacing
- Proper component hierarchy
- Correct variable usage
- All states defined
Step 2: Select & Record
1. Designer selects the exemplar frame
2. Clicks "Record as Rule" button
3. Plugin analyzes the design
Step 3: De-compilation
Plugin extracts:

Structure Analysis:
- Root: Card component (padding 24px, gap 24px)
- Child 1: Header container
  - Heading (text-2xl, font-semibold)
  - Paragraph (text-sm, text-muted-foreground)
- Child 2: Form (gap 16px)
  - FormField (gap 8px)
    - Label (text-sm, font-medium)
    - Input (h-10, border, rounded-md)
- Child 3: ButtonGroup (gap 8px)
  - PrimaryButton (h-10, w-full)
  - GhostButton (h-10, w-full)

Layout Patterns Detected:
- All vertical stacks (stack-v)
- Forms use gap-4
- Fields use gap-2
- Buttons fill width

Variable Usage Detected:
- Colors: All using semantic tokens (primary, muted-foreground, border)
- Spacing: Using design token variables where available
- Radius: Using --radius variable

Conditional Elements Detected:
- Alert component (hidden by default, shown on error)
Step 4: AI Rule Generation
Plugin sends structure to AI:

Prompt:
"Analyze this design structure and generate a natural language rule description 
and logic signature.

Structure: [JSON of extracted structure]

Generate:
1. Human-readable description
2. Logic signature (conditions and patterns)
3. Required vs optional elements
4. Responsive behavior (if varies by breakpoint)"

AI Response:
{
  "name": "Login Card Pattern",
  "description": "A card containing user authentication with email/password inputs, 
  primary action button, and optional error alert. Optimized for mobile-first with 
  comfortable spacing.",
  "semanticRole": "Card",
  "composition": {
    "required": ["Heading", "Form", "PrimaryButton"],
    "optional": ["Alert", "GhostButton"],
    "structure": "Header → Form → Actions"
  },
  "spacing": {
    "card": { "desktop": "p-8", "mobile": "p-4" },
    "sections": "gap-6",
    "form": "gap-4"
  },
  "constraints": {
    "maxWidth": 400,
    "centerOnMobile": true
  }
}
Step 5: Designer Review & Refinement
Plugin shows rule editor with:
- Generated description (editable)
- Detected patterns (confirm/adjust)
- Required elements (add/remove)
- Spacing values (adjust if needed)
- Responsive behavior (add breakpoint overrides)

Designer can:
✓ Accept as-is
✓ Edit description
✓ Adjust spacing values
✓ Add/remove required elements
✓ Define when rule applies (conditions)
Step 6: Save & Version
Rule saved with:
- Unique ID
- Name: "Login Card Pattern"
- Version: 1.0.0
- Created by: [Designer name]
- Created at: [Timestamp]
- Source exemplar: [Link to original frame]
- Logic: [Generated rule object]
- Tags: ["auth", "form", "card"]
8.3.2 Method 2: Import from Documentation
Concept: Extract rules from existing design system documentation.
Supported Sources:
Storybook (parse component stories)
Notion (parse markdown docs)
Confluence (parse wiki pages)
Figma comments/descriptions
Plain markdown files
Process:
Step 1: Import
Designer clicks "Import Rules"
Selects source:
○ Storybook URL
○ Notion page
● Confluence wiki
○ Markdown file

Enters: https://wiki.company.com/design-system/components
Step 2: Content Extraction
Plugin fetches content:
- Parses HTML/Markdown
- Identifies component specifications
- Extracts sizing, spacing, usage guidelines
- Captures code examples
Step 3: AI Parsing
For each component found:

AI analyzes:
"Button Component

The button is our primary action element. Use filled buttons for primary actions, 
outlined buttons for secondary actions.

Sizing:
- Small: 32px height, 12px padding
- Default: 40px height, 16px padding  
- Large: 48px height, 20px padding

Spacing:
Use 8px gap between buttons in a group.

Usage:
Limit to one primary button per section."

AI extracts:
{
  "component": "Button",
  "variants": {
    "style": ["filled", "outlined"],
    "size": ["sm", "md", "lg"]
  },
  "sizing": {
    "sm": { "height": "32px", "padding": "12px" },
    "md": { "height": "40px", "padding": "16px" },
    "lg": { "height": "48px", "padding": "20px" }
  },
  "constraints": {
    "maxPrimaryPerSection": 1,
    "groupSpacing": "8px"
  }
}
Step 4: Cross-Reference with Figma
For each imported component:

Check if exists in current file:
- Button found: "Button" component
- Properties match: Size [Small, Default, Large] ✓
- Dimensions match: Default = 40px ✓

Create mapping:
- Imported "filled" → Component "Type: Filled"
- Imported "outlined" → Component "Type: Outline"
- Imported "sm/md/lg" → Component "Size: Small/Default/Large"
Step 5: Generate Rules
Create rule for each component:

Rule: "Button Specifications"
- Source: Confluence wiki import
- Confidence: 0.75 (needs manual review)
- Semantic role: PrimaryButton, SecondaryButton
- Sizing: Maps to imported values
- Validation: Max 1 primary per section
Step 6: Review & Approve
Show import summary:
"✓ Found 12 components in documentation
✓ 8 matched to Figma components (67%)
⚠ 4 have no Figma component (needs creation)

Imported Rules:
✓ Button - High confidence (0.85)
✓ Input - High confidence (0.90)
⚠ Card - Medium confidence (0.70) - Review spacing
⚠ Select - Low confidence (0.55) - Incomplete docs
✗ DatePicker - Not found in Figma

Actions:
[Approve All High] [Review Medium] [Skip Low]"
Accuracy:
Storybook: 80-90% (structured data)
Notion/Confluence: 60-75% (less structured)
Markdown: 50-70% (varies by format)
Best Practice: Always review imported rules before using in production.
8.3.3 Method 3: Manual Definition
Concept: Create rules from scratch using guided editor.
Process:
Step 1: Create New Rule
Designer clicks "New Rule"
Selects template:
○ Button Pattern
○ Card Pattern
● Form Pattern
○ Custom (start from scratch)
Step 2: Define Semantic Role
Primary Role: [Form ▼]
Applies to: 
☑ Form
☑ FormGroup
☐ FormSection
Step 3: Define Structure
Layout Primitive: [stack-v ▼]

Required Children:
+ FormField (2+ instances)

Optional Children:
+ Alert (error display)
+ Heading (form title)

Child Arrangement:
□ Fixed order
☑ Flexible order
Step 4: Define Styling
Tailwind Classes:
Base: [gap-4___________] [Add class]
Desktop: [gap-6___________]
Mobile: [gap-3___________]

Constraints:
Width: ☑ Fill  ☐ Hug  ☐ Fixed
Height: ☐ Fill  ☑ Hug  ☐ Fixed
Max Width: [600_] px
Step 5: Define Composition Rules
Validation Rules:
☑ Warn if no FormFields
☑ Warn if no submit button
☐ Require minimum 2 fields
☑ Suggest grouping related fields

Nesting Rules:
☑ FormFields should be direct children
☑ Buttons should be in ButtonGroup
☐ Enforce specific field order
Step 6: Define Props
Supported Props:
+ title (string, optional) - Form heading
+ spacing ("compact"|"comfortable"|"spacious") - Density mode
+ submitLabel (string, default: "Submit") - Button text
+ showCancel (boolean, default: false) - Show cancel button
Step 7: Save & Test
Rule saved.

Test with AI:
"Generate a form with name and email fields"

Result:
✓ Generated Form with 2 FormFields
✓ Applied gap-4 spacing
✓ Added submit button
✓ Passed all validation rules

Confidence: 0.88
8.4 Rule Library Structure
8.4.1 Storage Schema
RuleLibrary {
  rules: Rule[]
  version: string
  createdBy: string
  lastModified: string
}

Rule {
  id: string (UUID)
  name: string
  version: string (semver)
  semanticRole: string
  
  logic: {
    layoutPrimitive: string
    tailwindClasses: string[]
    composition: {
      required: string[]
      optional: string[]
      structure: string
    }
    constraints: object
    responsive: object
    props: object
  }
  
  metadata: {
    description: string
    tags: string[]
    createdBy: string
    createdAt: string
    source: "record" | "import" | "manual"
    sourceExemplar?: string (frame ID)
    confidence: number
    usageCount: number
  }
  
  validation: {
    warnings: ValidationRule[]
    errors: ValidationRule[]
  }
}

ValidationRule {
  type: "missing-required" | "excess-primary" | "incorrect-structure"
  message: string
  severity: "error" | "warning" | "info"
  condition: LogicExpression
}
8.4.2 Organization
Hierarchical Categories:
Rule Library
├── Layout Patterns
│   ├── Cards
│   │   ├── Login Card
│   │   ├── Product Card
│   │   └── Dashboard Card
│   ├── Forms
│   │   ├── Contact Form
│   │   ├── Registration Form
│   │   └── Search Form
│   └── Navigation
│       ├── Top Navigation
│       └── Sidebar Navigation
├── Component Specifications
│   ├── Buttons
│   ├── Inputs
│   └── Feedback
└── Composition Rules
    ├── Button Hierarchy
    └── Form Field Grouping
Tagging System:
Tags applied to rules:
- Category: layout, component, composition
- Platform: web, mobile, desktop
- Complexity: simple, medium, complex
- Preset: shadcn, radix, material, custom
- Status: draft, reviewed, approved
Search & Filter:
Rule library UI:
[Search rules...______________________________] [🔍]

Filters:
Category: [All ▼]
Platform: [☑ Web  ☐ Mobile  ☐ Desktop]
Tags: [auth] [form] [card]
Status: [☑ Approved  ☐ Draft]
Preset: [All ▼]

Results (8):
✓ Login Card - v1.2.0 - Used 45 times
✓ Form Field Layout - v2.0.1 - Used 120 times
...
8.5 Rule Application Logic
8.5.1 Rule Selection
When AI generates RSNT:
For each RSNT node:

Step 1: Find matching rules
- Match by semantic role
- Filter by context (platform, preset)
- Rank by specificity and confidence

Step 2: Apply most specific rule
- If multiple matches, use highest confidence
- If tied, use most recently updated
- If no matches, use system defaults

Step 3: Merge with RSNT
- Rule provides defaults
- RSNT can override (if explicitly specified)
- Conflicts resolved using priority hierarchy
Example:
RSNT node: { semanticRole: "FormField", props: {} }

Matching rules:
1. "FormField Layout" (confidence: 0.95, updated: 1 day ago)
2. "Form Field - Compact" (confidence: 0.90, updated: 7 days ago)

Selected: "FormField Layout"

Applied:
- layoutPrimitive: "stack-v"
- tailwindClasses: ["gap-2"]
- composition: { required: ["Label", "Input"] }

Result RSNT:
{
  semanticRole: "FormField",
  layoutPrimitive: "stack-v",  ← From rule
  tailwindClasses: ["gap-2"],   ← From rule
  children: [
    { semanticRole: "Label", ... },
    { semanticRole: "Input", ... }
  ]
}
8.5.2 Rule Precedence
Order of precedence (highest to lowest):
Explicit RSNT values - If AI/designer explicitly specifies a value in RSNT
Context-specific rules - Rules tagged for current preset/platform
General rules - Rules without specific context
System defaults - Built-in fallback values
Example:
RSNT specifies: tailwindClasses: ["gap-4"]
Rule specifies: tailwindClasses: ["gap-2"]

Result: Use RSNT value (gap-4) ← Explicit wins

---

RSNT specifies: tailwindClasses: []
Rule A (Shadcn context): ["gap-2"]
Rule B (general): ["gap-4"]
Current preset: Shadcn

Result: Use Rule A (gap-2) ← Context-specific wins
8.6 Rule Versioning
8.6.1 Semantic Versioning
Rules use semantic versioning: MAJOR.MINOR.PATCH
Version Bump Triggers:
MAJOR (1.0.0 → 2.0.0):
Changed semantic role
Removed required properties
Changed structure (different layout primitive)
Breaking changes to validation rules
MINOR (1.0.0 → 1.1.0):
Added optional properties
Added new validation warnings
Refined styling (non-breaking)
Added responsive variants
PATCH (1.0.0 → 1.0.1):
Fixed bugs in logic
Updated description
Fixed typos
Performance improvements
8.6.2 Version Storage
Per-design metadata:
Design in Figma stores:
{
  "generatedWith": {
    "pluginVersion": "1.2.0",
    "ruleLibraryVersion": "2.3.1",
    "rulesUsed": [
      { "ruleId": "login-card-001", "version": "1.2.0" },
      { "ruleId": "form-field-002", "version": "2.0.1" }
    ]
  }
}

Stored in: figma.root.getPluginData('generation-metadata')
8.6.3 Version Management UI
Rule Version History:
┌──────────────────────────────────────────────────────┐
│ Login Card Pattern - Version History                 │
├──────────────────────────────────────────────────────┤
│                                                       │
│ ● v1.2.0 (Current) - Jan 27, 2026                   │
│   Added mobile responsive spacing                    │
│   Changed: Desktop padding p-8, Mobile p-4          │
│   [View] [Rollback]                                  │
│                                                       │
│ ○ v1.1.0 - Jan 15, 2026                             │
│   Added optional "remember me" checkbox             │
│   [View] [Restore]                                   │
│                                                       │
│ ○ v1.0.0 - Jan 1, 2026                              │
│   Initial release                                    │
│   [View]                                             │
│                                                       │
└──────────────────────────────────────────────────────┘

9. Execution & Rendering Engine
9.1 Purpose & Responsibility
The Execution Engine translates resolved RSNT instructions into actual Figma nodes on the canvas.
Core Responsibility: Create Figma frames, components, and content while respecting Auto Layout, constraints, and metadata requirements.
Why It's Critical:
Final step that makes designs visible
Must handle complex nested structures
Performance critical (directly affects UX)
Must attach metadata for code export
9.2 Execution Pipeline
9.2.1 Pre-Execution Validation
Before creating anything:
function validateBeforeExecution(rsnt: RSNT_Node, resolutionResults: ResolutionResult[]): ValidationResult {
  
  // Check 1: RSNT is valid
  if (!validateRSNT(rsnt)) {
    return { valid: false, error: "RSNT schema validation failed" }
  }
  
  // Check 2: All nodes resolved successfully
  const unresolvedNodes = resolutionResults.filter(r => !r.success)
  if (unresolvedNodes.length > 0) {
    return { valid: false, error: `${unresolvedNodes.length} nodes failed resolution` }
  }
  
  // Check 3: No circular dependencies
  if (hasCircularDeps(rsnt)) {
    return { valid: false, error: "Circular dependency detected" }
  }
  
  // Check 4: Reasonable node count (prevent freezing)
  const nodeCount = countNodes(rsnt)
  if (nodeCount > 500) {
    return { 
      valid: true, 
      warning: `Large design (${nodeCount} nodes). This may take time.` 
    }
  }
  
  return { valid: true }
}
9.2.2 Recursive Rendering Algorithm
Core rendering function:
typescript
async function renderNode(
  rsntNode: RSNT_Node, 
  resolutionInstruction: ResolutionInstruction,
  parentNode?: SceneNode
): Promise<SceneNode> {
  
  // Step 1: Create base node (component or frame)
  let node: SceneNode
  
  if (resolutionInstruction.type === 'INSTANTIATE_COMPONENT') {
    // Use client component
    node = figma.createComponentInstance(resolutionInstruction.componentId)
    
    // Set component properties
    for (const [propName, propValue] of Object.entries(resolutionInstruction.properties)) {
      node.setProperties({ [propName]: propValue })
    }
    
  } else {
    // Create frame from scratch
    node = figma.createFrame()
    
    // Apply layout primitive
    applyLayoutPrimitive(node, rsntNode.layoutPrimitive)
    
    // Apply styling
    await applyStyling(node, rsntNode.tailwindClasses, resolutionInstruction)
  }
  
  // Step 2: Set basic properties
  node.name = generateNodeName(rsntNode)
  
  // Step 3: Apply constraints
  applyConstraints(node, rsntNode.constraints)
  
  // Step 4: Render children (recursive)
  if (rsntNode.children && rsntNode.children.length > 0) {
    for (const childRSNT of rsntNode.children) {
      const childResolution = await resolveNode(childRSNT) // Get resolution for child
      const childNode = await renderNode(childRSNT, childResolution, node)
      node.appendChild(childNode)
    }
  }
  
  // Step 5: Attach metadata
  attachMetadata(node, rsntNode)
  
  // Step 6: Add to parent (if specified)
  if (parentNode && 'appendChild' in parentNode) {
    parentNode.appendChild(node)
  }
  
  return node
}
9.2.3 Layout Primitive Translation
Map each layout primitive to Figma Auto Layout:
typescript
function applyLayoutPrimitive(node: FrameNode, primitive: string) {
  
  const layoutConfig: Record<string, AutoLayoutConfig> = {
    'stack-v': {
      layoutMode: 'VERTICAL',
      primaryAxisAlignItems: 'MIN',
      counterAxisAlignItems: 'MIN'
    },
    'stack-v-start': {
      layoutMode: 'VERTICAL',
      primaryAxisAlignItems: 'MIN',
      counterAxisAlignItems: 'MIN'
    },
    'stack-v-center': {
      layoutMode: 'VERTICAL',
      primaryAxisAlignItems: 'MIN',
      counterAxisAlignItems: 'CENTER'
    },
    'stack-h': {
      layoutMode: 'HORIZONTAL',
      primaryAxisAlignItems: 'MIN',
      counterAxisAlignItems: 'MIN'
    },
    'stack-h-center': {
      layoutMode: 'HORIZONTAL',
      primaryAxisAlignItems: 'CENTER',
      counterAxisAlignItems: 'CENTER'
    },
    'flex-center-both': {
      layoutMode: 'HORIZONTAL',
      primaryAxisAlignItems: 'CENTER',
      counterAxisAlignItems: 'CENTER'
    },
    'flex-space-between': {
      layoutMode: 'HORIZONTAL',
      primaryAxisAlignItems: 'SPACE_BETWEEN',
      counterAxisAlignItems: 'CENTER'
    },
    'flex-wrap': {
      layoutMode: 'HORIZONTAL',
      primaryAxisAlignItems: 'MIN',
      counterAxisAlignItems: 'MIN',
      layoutWrap: 'WRAP'
    }
  }
  
  const config = layoutConfig[primitive]
  
  if (config) {
    node.layoutMode = config.layoutMode
    node.primaryAxisAlignItems = config.primaryAxisAlignItems
    node.counterAxisAlignItems = config.counterAxisAlignItems
    if (config.layoutWrap) {
      node.layoutWrap = config.layoutWrap
    }
  } else {
    console.warn(`Unknown layout primitive: ${primitive}`)
    // Default to vertical stack
    node.layoutMode = 'VERTICAL'
  }
}
Grid layouts (manual implementation):
typescript
// Grid layouts need manual positioning (Figma doesn't have CSS grid)
function applyGridLayout(node: FrameNode, primitive: string) {
  
  if (primitive === 'grid-2-col') {
    // Create 2-column grid manually
    node.layoutMode = 'HORIZONTAL'
    node.layoutWrap = 'WRAP'
    
    // Set fixed width for children to create 2-column effect
    // This is a simplification; real implementation would calculate based on parent width
    node.children.forEach(child => {
      if ('layoutSizingHorizontal' in child) {
        child.layoutSizingHorizontal = 'FILL'
      }
    })
  }
  
  // Similar for grid-3-col, grid-4-col...
}
9.2.4 Styling Application
Apply Tailwind classes as Figma properties:
typescript
async function applyStyling(
  node: FrameNode, 
  tailwindClasses: string[],
  resolution: ResolutionInstruction
) {
  
  for (const twClass of tailwindClasses) {
    
    // Padding
    if (twClass.startsWith('p-')) {
      const value = parseTailwindSpacing(twClass)
      node.paddingLeft = value
      node.paddingRight = value
      node.paddingTop = value
      node.paddingBottom = value
    }
    else if (twClass.startsWith('px-')) {
      const value = parseTailwindSpacing(twClass)
      node.paddingLeft = value
      node.paddingRight = value
    }
    else if (twClass.startsWith('py-')) {
      const value = parseTailwindSpacing(twClass)
      node.paddingTop = value
      node.paddingBottom = value
    }
    
    // Gap
    else if (twClass.startsWith('gap-')) {
      const value = parseTailwindSpacing(twClass)
      node.itemSpacing = value
    }
    
    // Background color
    else if (twClass.startsWith('bg-')) {
      const color = await resolveColor(twClass, resolution)
      if (color) {
        node.fills = [color]
      }
    }
    
    // Border
    else if (twClass === 'border') {
      node.strokes = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }]
      node.strokeWeight = 1
    }
    
    // Border radius
    else if (twClass.startsWith('rounded-')) {
      const radius = parseTailwindRadius(twClass)
      node.cornerRadius = radius
    }
    
    // Width/Height
    else if (twClass.startsWith('w-')) {
      applyWidth(node, twClass)
    }
    else if (twClass.startsWith('h-')) {
      applyHeight(node, twClass)
    }
  }
}

function parseTailwindSpacing(className: string): number {
  // Extract number from class like "p-4", "gap-6"
  const match = className.match(/-(\d+)$/)
  if (match) {
    const value = parseInt(match[1])
    // Tailwind scale: 1 = 4px
    return value * 4
  }
  return 0
}

function parseTailwindRadius(className: string): number {
  const radiusMap: Record<string, number> = {
    'rounded-none': 0,
    'rounded-sm': 2,
    'rounded': 4,
    'rounded-md': 6,
    'rounded-lg': 8,
    'rounded-xl': 12,
    'rounded-2xl': 16,
    'rounded-full': 9999
  }
  return radiusMap[className] || 0
}
Color resolution (using variables):
typescript
async function resolveColor(className: string, resolution: ResolutionInstruction): Promise<Paint | null> {
  
  // Check if resolution provides variable binding
  if (resolution.variableBindings) {
    const binding = resolution.variableBindings.find(b => 
      b.property === 'fills' && b.tailwindClass === className
    )
    
    if (binding) {
      // Use variable
      return {
        type: 'SOLID',
        color: { r: 0, g: 0, b: 0 }, // Placeholder
        boundVariables: {
          color: { type: 'VARIABLE_ALIAS', id: binding.variableId }
        }
      }
    }
  }
  
  // Fallback to raw color
  const colorValue = getTailwindColorValue(className)
  if (colorValue) {
    return {
      type: 'SOLID',
      color: hexToRgb(colorValue)
    }
  }
  
  return null
}
9.2.5 Constraint Application
typescript
function applyConstraints(node: SceneNode, constraints: RSNT_Constraints) {
  
  if ('layoutSizingHorizontal' in node) {
    // Width
    switch (constraints.width) {
      case 'hug':
        node.layoutSizingHorizontal = 'HUG'
        break
      case 'fill':
        node.layoutSizingHorizontal = 'FILL'
        break
      case 'fixed':
        node.layoutSizingHorizontal = 'FIXED'
        if (constraints.maxWidth) {
          node.resize(constraints.maxWidth, node.height)
        }
        break
    }
    
    // Height
    switch (constraints.height) {
      case 'hug':
        node.layoutSizingVertical = 'HUG'
        break
      case 'fill':
        node.layoutSizingVertical = 'FILL'
        break
      case 'fixed':
        node.layoutSizingVertical = 'FIXED'
        if (constraints.maxHeight) {
          node.resize(node.width, constraints.maxHeight)
        }
        break
    }
    
    // Min/Max constraints
    if (constraints.minWidth) {
      node.minWidth = constraints.minWidth
    }
    if (constraints.maxWidth && constraints.width !== 'fixed') {
      node.maxWidth = constraints.maxWidth
    }
  }
}
9.2.6 Metadata Attachment
Store RSNT and generation info in pluginData:
typescript
function attachMetadata(node: SceneNode, rsntNode: RSNT_Node) {
  
  // Store complete RSNT fragment
  node.setPluginData('rsnt', JSON.stringify(rsntNode))
  
  // Store generation metadata
  const metadata = {
    generatedAt: new Date().toISOString(),
    pluginVersion: '1.0.0',
    semanticRole: rsntNode.semanticRole,
    layoutPrimitive: rsntNode.layoutPrimitive,
    ruleVersion: rsntNode.metadata.ruleVersion,
    confidence: rsntNode.metadata.confidence
  }
  
  node.setPluginData('generation-metadata', JSON.stringify(metadata))
  
  // Set accessible name for screen readers
  if (rsntNode.props.ariaLabel) {
    node.name = `${rsntNode.semanticRole}: ${rsntNode.props.ariaLabel}`
  } else if (rsntNode.props.label) {
    node.name = `${rsntNode.semanticRole}: ${rsntNode.props.label}`
  } else {
    node.name = rsntNode.semanticRole
  }
}
9.3 State Variant Handling
For MVP: Create static variants, designer links manually
Process:
typescript
async function renderStateVariants(rsntNode: RSNT_Node): Promise<ComponentSetNode | FrameNode> {
  
  if (!rsntNode.stateVariants || Object.keys(rsntNode.stateVariants).length === 0) {
    // No variants, render normally
    return await renderNode(rsntNode, resolution)
  }
  
  // Create component set
  const componentSet = figma.createComponentSet()
  componentSet.name = rsntNode.semanticRole
  
  // Render default state
  const defaultComponent = await renderAsComponent(rsntNode)
  defaultComponent.name = 'Default'
  componentSet.appendChild(defaultComponent)
  
  // Render each state variant
  for (const [stateName, stateOverrides] of Object.entries(rsntNode.stateVariants)) {
    // Merge overrides with base RSNT
    const variantRSNT = mergeRSNT(rsntNode, stateOverrides)
    
    const variantComponent = await renderAsComponent(variantRSNT)
    variantComponent.name = capitalize(stateName) // "Hover", "Disabled", etc.
    
    componentSet.appendChild(variantComponent)
  }
  
  // Add State property to component set
  componentSet.addComponentProperty('State', 'VARIANT', 'Default')
  
  // Position variants horizontally
  layoutComponentsHorizontally(componentSet.children)
  
  return componentSet
}
Alternative (simpler for MVP):
Render only default state
Add comment noting other states exist in metadata
Designer can manually create variants later if needed
9.4 Conditional Rendering Handling
For MVP: Render both states, group together
typescript
async function renderConditional(rsntNode: RSNT_Node): Promise<GroupNode> {
  
  const group = figma.createGroup()
  group.name = `Conditional: ${rsntNode.conditionalRender?.showIf.variable || 'unknown'}`
  
  // Render shown state (main content)
  const shownNode = await renderNode(rsntNode, resolution)
  shownNode.name = `Shown (if ${rsntNode.conditionalRender?.showIf.variable})`
  group.appendChild(shownNode)
  
  // Render fallback state (if exists)
  if (rsntNode.conditionalRender?.fallback) {
    const fallbackNode = await renderNode(rsntNode.conditionalRender.fallback, fallbackResolution)
    fallbackNode.name = 'Fallback (else)'
    fallbackNode.opacity = 0.5 // Visual indicator it's alternative
    fallbackNode.y = shownNode.height + 20 // Position below
    group.appendChild(fallbackNode)
  }
  
  // Add comment explaining condition
  const comment = `CONDITIONAL: Shows based on ${JSON.stringify(rsntNode.conditionalRender?.showIf)}`
  group.setPluginData('conditional-logic', comment)
  
  return group
}
9.5 Performance Optimization
9.5.1 Chunking Strategy
Problem: Creating 100+ nodes synchronously freezes UI
Solution: Batch creation with yield points
typescript
async function executeWithChunking(rsnt: RSNT_Node): Promise<void> {
  
  const CHUNK_SIZE = 25 // Process 25 nodes at a time
  
  // Flatten RSNT tree into array
  const nodeQueue = flattenRSNT(rsnt)
  
  let processedCount = 0
  const totalNodes = nodeQueue.length
  
  // Process in chunks
  for (let i = 0; i < nodeQueue.length; i += CHUNK_SIZE) {
    const chunk = nodeQueue.slice(i, i + CHUNK_SIZE)
    
    // Process chunk
    await Promise.all(chunk.map(async (node) => {
      const resolution = await resolveNode(node.rsnt)
      const figmaNode = await renderNode(node.rsnt, resolution, node.parent)
      node.result = figmaNode
    }))
    
    processedCount += chunk.length
    
    // Update progress
    figma.ui.postMessage({
      type: 'progress',
      current: processedCount,
      total: totalNodes,
      percentage: Math.round((processedCount / totalNodes) * 100)
    })
    
    // Yield to main thread (prevent UI freeze)
    await new Promise(resolve => setTimeout(resolve, 0))
  }
}
9.5.2 Progress Indicator
Show progress during generation:
typescript
// In plugin UI
figma.ui.onmessage = (msg) => {
  if (msg.type === 'progress') {
    updateProgressBar(msg.percentage)
    updateProgressText(`Creating ${msg.current} of ${msg.total} elements...`)
  }
}

function updateProgressBar(percentage: number) {
  const progressBar = document.getElementById('progress-bar')
  progressBar.style.width = `${percentage}%`
}
UI:
┌──────────────────────────────────────────┐
│ Generating Design...                     │
├──────────────────────────────────────────┤
│                                          │
│ Creating 47 of 120 elements...          │
│                                          │
│ [████████░░░░░░░░░░░░] 39%              │
│                                          │
│         [Cancel Generation]              │
│                                          │
└──────────────────────────────────────────┘
9.5.3 Cancellation Support
typescript
let cancellationRequested = false

figma.ui.onmessage = (msg) => {
  if (msg.type === 'cancel-generation') {
    cancellationRequested = true
  }
}

async function executeWithCancellation(rsnt: RSNT_Node): Promise<void> {
  const nodeQueue = flattenRSNT(rsnt)
  const createdNodes: SceneNode[] = []
  
  try {
    for (const node of nodeQueue) {
      // Check for cancellation
      if (cancellationRequested) {
        throw new Error('Generation cancelled by user')
      }
      
      const figmaNode = await renderNode(node.rsnt, node.resolution)
      createdNodes.push(figmaNode)
    }
  } catch (error) {
    // Rollback: delete all created nodes
    createdNodes.forEach(node => node.remove())
    
    figma.notify('Generation cancelled')
    return
  }
}
9.6 Post-Execution
9.6.1 Final Steps
typescript
async function postExecution(rootNode: SceneNode) {
  
  // Step 1: Group related nodes
  if (rootNode.parent?.type === 'PAGE') {
    const group = figma.group([rootNode], rootNode.parent)
    group.name = `Generated: ${new Date().toLocaleString()}`
  }
  
  // Step 2: Set selection
  figma.currentPage.selection = [rootNode]
  
  // Step 3: Center viewport
  figma.viewport.scrollAndZoomIntoView([rootNode])
  
  // Step 4: Show success notification
  figma.notify('✓ Design generated successfully')
  
  // Step 5: Log performance metrics
  const endTime = performance.now()
  const duration = endTime - startTime
  console.log(`Generation completed in ${duration}ms`)
  
  // Step 6: Enable code export button
  figma.ui.postMessage({ type: 'generation-complete', nodeId: rootNode.id })
}

10. Code Export & Semantic Output
10.1 Purpose & Responsibility
The Code Export system generates production-ready code that exactly matches the Figma design.
Core Responsibility: Convert Figma nodes + RSNT metadata into clean, maintainable code for web/mobile frameworks.
Why It's Critical:
Eliminates manual implementation errors
Accelerates developer handoff
Maintains design-dev parity
Enables true design-to-code workflow
10.2 Export Process
10.2.1 Metadata Extraction
Step 1: Read RSNT from Selected Node
typescript
function extractRSNT(node: SceneNode): RSNT_Node {
  // Read stored RSNT metadata
  const rsntData = node.getPluginData('rsnt')
  
  if (!rsntData) {
    throw new Error('No RSNT metadata found. Was this generated by the plugin?')
  }
  
  return JSON.parse(rsntData)
}
Step 2: Traverse Tree
typescript
function extractDesignStructure(rootNode: SceneNode): ExportData {
  const rsnt = extractRSNT(rootNode)
  
  return {
    rsnt: rsnt,
    figmaProperties: extractFigmaProperties(rootNode),
    children: rootNode.children?.map(child => extractDesignStructure(child)) || []
  }
}

function extractFigmaProperties(node: SceneNode): FigmaProps {
  return {
    width: node.width,
    height: node.height,
    x: node.x,
    y: node.y,
    fills: node.fills,
    strokes: node.strokes,
    // ... other Figma properties
  }
}
10.2.2 Component Mapping
Map RSNT semantic roles to framework components:
typescript
function mapToPresetComponent(semanticRole: string, preset: string): ComponentMapping {
  
  const shadcnMappings: Record<string, ComponentMapping> = {
    'PrimaryButton': {
      import: 'import { Button } from "@/components/ui/button"',
      component: 'Button',
      props: { variant: 'default' }
    },
    'SecondaryButton': {
      import: 'import { Button } from "@/components/ui/button"',
      component: 'Button',
      props: { variant: 'secondary' }
    },
    'GhostButton': {
      import: 'import { Button } from "@/components/ui/button"',
      component: 'Button',
      props: { variant: 'ghost' }
    },
    'Card': {
      import: 'import { Card } from "@/components/ui/card"',
      component: 'Card',
      props: {}
    },
    'Input': {
      import: 'import { Input } from "@/components/ui/input"',
      component: 'Input',
      props: {}
    },
    // ... more mappings
  }
  
  if (preset === 'shadcn') {
    return shadcnMappings[semanticRole] || null
  }
  
  return null
}
Fallback to plain HTML/Tailwind:
typescript
function mapToHTMLElement(semanticRole: string): string {
  const htmlMappings: Record<string, string> = {
    'Heading': 'h2',
    'Paragraph': 'p',
    'Container': 'div',
    'PrimaryButton': 'button',
    'Link': 'a',
    'Image': 'img',
    'List': 'ul',
    'ListItem': 'li',
    // ... default mappings
  }
  
  return htmlMappings[semanticRole] || 'div'
}
10.2.3 Code Generation
Generate React component:
typescript
function generateReactComponent(exportData: ExportData, options: ExportOptions): string {
  
  const { rsnt, children } = exportData
  
  // Determine element type
  let elementCode: string
  
  if (options.preset && options.preset !== 'none') {
    // Use preset component
    const mapping = mapToPresetComponent(rsnt.semanticRole, options.preset)
    
    if (mapping) {
      elementCode = generatePresetComponent(rsnt, mapping, children, options)
    } else {
      elementCode = generateHTMLElement(rsnt, children, options)
    }
  } else {
    // Use plain HTML
    elementCode = generateHTMLElement(rsnt, children, options)
  }
  
  return elementCode
}

function generatePresetComponent(
  rsnt: RSNT_Node,
  mapping: ComponentMapping,
  children: ExportData[],
  options: ExportOptions
): string {
  
  const props: string[] = []
  
  // Add mapped props
  for (const [key, value] of Object.entries(mapping.props)) {
    props.push(`${key}="${value}"`)
  }
  
  // Add RSNT props
  if (rsnt.props.variant) {
    props.push(`variant="${rsnt.props.variant}"`)
  }
  if (rsnt.props.size) {
    props.push(`size="${rsnt.props.size}"`)
  }
  
  // Add className with Tailwind classes
  const className = rsnt.tailwindClasses.join(' ')
  if (className) {
    props.push(`className="${className}"`)
  }
  
  // Generate children code
  const childrenCode = children.map(child => 
    generateReactComponent(child, options)
  ).join('\n')
  
  // Build component
  const propsString = props.length > 0 ? ' ' + props.join(' ') : ''
  
  if (rsnt.props.label && !childrenCode) {
    return `<${mapping.component}${propsString}>${rsnt.props.label}</${mapping.component}>`
  } else if (childrenCode) {
    return `<${mapping.component}${propsString}>\n${indent(childrenCode)}\n</${mapping.component}>`
  } else {
    return `<${mapping.component}${propsString} />`
  }
}

function generateHTMLElement(
  rsnt: RSNT_Node,
  children: ExportData[],
  options: ExportOptions
): string {
  
  const htmlTag = mapToHTMLElement(rsnt.semanticRole)
  const className = rsnt.tailwindClasses.join(' ')
  
  const childrenCode = children.map(child =>
    generateReactComponent(child, options)
  ).join('\n')
  
  if (childrenCode) {
    return `<${htmlTag} className="${className}">\n${indent(childrenCode)}\n</${htmlTag}>`
  } else if (rsnt.props.label || rsnt.props.text) {
    return `<${htmlTag} className="${className}">${rsnt.props.label || rsnt.props.text}</${htmlTag}>`
  } else {
    return `<${htmlTag} className="${className}" />`
  }
}

function indent(code: string, spaces: number = 2): string {
  return code.split('\n').map(line => ' '.repeat(spaces) + line).join('\n')
}
Example output:
tsx
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginCard() {
  return (
    <Card className="w-full max-w-md p-8 gap-6">
      <CardHeader>
        <h2 className="text-2xl font-semibold">Welcome back</h2>
        <p className="text-sm text-muted-foreground">Enter your credentials</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" />
        </div>
        <Button className="w-full">Sign in</Button>
      </CardContent>
    </Card>
  )
}
10.2.4 Responsive Classes
Generate mobile-first Tailwind:
typescript
function generateResponsiveClasses(rsnt: RSNT_Node): string {
  const classes: string[] = []
  
  // Base classes (mobile, no prefix)
  if (rsnt.responsive?.mobile?.tailwindClasses) {
    classes.push(...rsnt.responsive.mobile.tailwindClasses)
  } else {
    classes.push(...rsnt.tailwindClasses)
  }
  
  // Tablet classes (md: prefix)
  if (rsnt.responsive?.tablet?.tailwindClasses) {
    const tabletClasses = rsnt.responsive.tablet.tailwindClasses.map(c => `md:${c}`)
    classes.push(...tabletClasses)
  }
  
  // Desktop classes (lg: prefix)
  if (rsnt.responsive?.desktop?.tailwindClasses) {
    const desktopClasses = rsnt.responsive.desktop.tailwindClasses.map(c => `lg:${c}`)
    classes.push(...desktopClasses)
  }
  
  return classes.join(' ')
}
Example:
tsx
<Card className="p-4 gap-3 md:p-6 md:gap-4 lg:p-8 lg:gap-6">
10.2.5 State Variant Code
Generate hover/focus/disabled states:
typescript
function generateStateClasses(rsnt: RSNT_Node): string {
  const classes: string[] = [...rsnt.tailwindClasses]
  
  // Hover state
  if (rsnt.stateVariants?.hover) {
    const hoverClasses = rsnt.stateVariants.hover.tailwindClasses?.map(c => `hover:${c}`) || []
    classes.push(...hoverClasses)
  }
  
  // Focus state
  if (rsnt.stateVariants?.focus) {
    const focusClasses = rsnt.stateVariants.focus.tailwindClasses?.map(c => `focus:${c}`) || []
    classes.push(...focusClasses)
  }
  
  // Active state
  if (rsnt.stateVariants?.active) {
    const activeClasses = rsnt.stateVariants.active.tailwindClasses?.map(c => `active:${c}`) || []
    classes.push(...activeClasses)
  }
  
  // Disabled state
  if (rsnt.stateVariants?.disabled) {
    const disabledClasses = rsnt.stateVariants.disabled.tailwindClasses?.map(c => `disabled:${c}`) || []
    classes.push(...disabledClasses)
  }
  
  return classes.join(' ')
}
Example:
tsx
<Button className="bg-primary hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50">
Loading state with conditional rendering:
typescript
function generateLoadingState(rsnt: RSNT_Node, options: ExportOptions): string {
  
  if (!rsnt.stateVariants?.loading) {
    return '' // No loading state
  }
  
  const loadingLabel = rsnt.stateVariants.loading.props?.label || 'Loading...'
  
  return `
{isLoading ? (
  <Button disabled className="${rsnt.tailwindClasses.join(' ')}">
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    ${loadingLabel}
  </Button>
) : (
  <Button className="${rsnt.tailwindClasses.join(' ')}">
    ${rsnt.props.label}
  </Button>
)}
`.trim()
}
10.2.6 Conditional Rendering Code
Generate JavaScript conditionals:
typescript
function generateConditionalCode(rsnt: RSNT_Node, options: ExportOptions): string {
  
  if (!rsnt.conditionalRender) {
    return generateReactComponent({ rsnt, children: [] }, options)
  }
  
  const condition = generateConditionExpression(rsnt.conditionalRender.showIf)
  const mainElement = generateReactComponent({ rsnt, children: [] }, options)
  
  if (rsnt.conditionalRender.fallback) {
    const fallbackElement = generateReactComponent(
      { rsnt: rsnt.conditionalRender.fallback, children: [] }, 
      options
    )
    
    return `{${condition} ? (\n${indent(mainElement)}\n) : (\n${indent(fallbackElement)}\n)}`
  } else {
    return `{${condition} && (\n${indent(mainElement)}\n)}`
  }
}

function generateConditionExpression(condition: ConditionalExpression): string {
  
  if (condition.type === 'boolean') {
    return condition.variable!
  }
  
  else if (condition.type === 'comparison') {
    return `${condition.left} ${condition.operator} ${JSON.stringify(condition.right)}`
  }
  
  else if (condition.type === 'compound') {
    const subConditions = condition.conditions!.map(c => generateConditionExpression(c))
    const operator = condition.logic === 'AND' ? '&&' : '||'
    return `(${subConditions.join(` ${operator} `)})`
  }
  
  return 'true'
}
Example:
tsx
{hasError && (
  <Alert variant="destructive">
    <AlertDescription>Invalid credentials</AlertDescription>
  </Alert>
)}

{itemCount > 0 ? (
  <DataList items={items} />
) : (
  <EmptyState message="No items found" />
)}
10.2.7 Form State Handling
Generate complete form with state management:
typescript
function generateFormCode(rsnt: RSNT_Node, options: ExportOptions): string {
  
  // Collect all form fields
  const fields = collectFormFields(rsnt)
  
  // Generate state hooks
  const stateHooks = fields.map(field => {
    const fieldName = field.props.name || camelCase(field.props.label)
    return `const [${fieldName}, set${capitalize(fieldName)}] = useState('')`
  }).join('\n')
  
  // Generate error state
  const errorHook = `const [errors, setErrors] = useState<Record<string, string>>({})`
  
  // Generate submit handler
  const submitHandler = `
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsSubmitting(true)
  setErrors({})
  
  try {
    // Validation
    const newErrors: Record<string, string> = {}
    ${fields.map(field => {
      if (field.props.required) {
        const fieldName = field.props.name || camelCase(field.props.label)
        return `if (!${fieldName}) newErrors['${fieldName}'] = 'This field is required'`
      }
      return ''
    }).filter(Boolean).join('\n    ')}
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      setIsSubmitting(false)
      return
    }
    
    // Submit logic
    // TODO: Add your submit logic here
    console.log('Form submitted', { ${fields.map(f => camelCase(f.props.label || 'field')).join(', ')} })
    
  } catch (error) {
    console.error('Submit error:', error)
  } finally {
    setIsSubmitting(false)
  }
}
  `.trim()
  
  // Generate complete component
  return `
import { useState } from 'react'
${generateImports(rsnt, options)}

export function ${options.componentName || 'FormComponent'}() {
  ${stateHooks}
  ${errorHook}
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  ${submitHandler}
  
  return (
    <form onSubmit={handleSubmit}>
      ${generateFormElements(rsnt, fields, options)}
    </form>
  )
}
  `.trim()
}
Example output:
tsx
import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // ... validation and submit logic
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={errors.email ? 'border-destructive' : ''}
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
      </div>
      
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </Button>
    </form>
  )
}
10.3 Export Options
Designer configurable options:
typescript
interface ExportOptions {
  // Format
  format: 'react' | 'vue' | 'html' | 'react-native'
  
  // Styling
  styling: 'tailwind' | 'css-modules' | 'styled-components' | 'inline'
  
  // Component Style
  componentStyle: 'functional' | 'class'
  
  // File Structure
  fileStructure: 'single-file' | 'multi-file'
  
  // Includes
  includeTypes: boolean
  includePropTypes: boolean
  includeComments: boolean
  includeStorybook: boolean
  
  // Preset
  preset: 'shadcn' | 'radix' | 'material' | 'none'
  
  // Component Name
  componentName?: string
  
  // Accessibility
  includeAriaLabels: boolean
  
  // State Management
  includeStateManagement: boolean
}
Export Dialog UI:
┌──────────────────────────────────────────────────────────┐
│ Export Code                                               │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ Format: [React ▼]                                        │
│ Styling: [Tailwind CSS ▼]                               │
│ Component Style: ● Functional  ○ Class                   │
│                                                           │
│ Options:                                                  │
│ ☑ TypeScript types                                       │
│ ☑ PropTypes                                              │
│ ☑ Comments                                               │
│ ☐ Storybook story                                        │
│ ☑ State management (for forms)                          │
│ ☑ Accessibility attributes                               │
│                                                           │
│ Component Name: [LoginCard_______]                      │
│                                                           │
│ [Preview] [Copy to Clipboard] [Download] [Open in IDE]  │
│                                                           │
└──────────────────────────────────────────────────────────┘
10.4 Export Quality Guarantees
The system ensures:
Valid Code - No syntax errors, passes linting
Semantic HTML - Proper element types (button, form, etc.)
Accessible - ARIA labels, keyboard navigation
Responsive - Mobile-first Tailwind classes
Maintainable - Clean, commented, follows conventions
Pixel-Perfect - Matches Figma dimensions exactly
Validation:
typescript
function validateExportedCode(code: string, options: ExportOptions): ValidationResult {
  
  const issues: string[] = []
  
  // Check 1: Syntax
  try {
    // Parse code (using appropriate parser for format)
    if (options.format === 'react') {
      // Use TypeScript parser
      parseTypeScript(code)
    }
  } catch (error) {
    issues.push(`Syntax error: ${error.message}`)
  }
  
  // Check 2: Accessibility
  const ariaIssues = checkAccessibility(code)
  issues.push(...ariaIssues)
  
  // Check 3: Best practices
  if (code.includes('div') && !code.includes('semantic elements')) {
    issues.push('Consider using semantic HTML elements')
  }
  
  return {
    valid: issues.length === 0,
    issues
  }
}
11. State Management & Conditional Rendering
11.1 The Challenge
Figma designs are static snapshots, but production UIs need dynamic behavior:
Buttons have hover/focus/pressed states
Forms show error/loading/success states
Elements appear/disappear based on conditions
Content changes based on data
Solution: Encode state logic in RSNT metadata, handle appropriately in Figma and code export.
11.2 State Variant System
11.2.1 State Types
Interactive States (User-triggered):
hover - Mouse over element
focus - Element has keyboard/input focus
active - Element being clicked/pressed
visited - Link previously visited (links only)
Status States (Application-triggered):
disabled - Element cannot be interacted with
error - Element has validation error
loading - Element performing async operation
success - Operation completed successfully
11.2.2 RSNT State Variant Structure
typescript
// Example: Button with hover and loading states
{
  id: "btn-001",
  semanticRole: "PrimaryButton",
  layoutPrimitive: "stack-h-center",
  tailwindClasses: ["px-4", "py-2", "bg-primary", "text-white"],
  props: { label: "Submit" },
  
  stateVariants: {
    hover: {
      tailwindClasses: ["bg-primary-600"] // Darker on hover
    },
    focus: {
      tailwindClasses: ["ring-2", "ring-primary", "ring-offset-2"]
    },
    disabled: {
      tailwindClasses: ["opacity-50", "cursor-not-allowed"],
      props: { disabled: true }
    },
    loading: {
      props: { label: "Submitting..." },
      children: [
        {
          id: "spinner-001",
          semanticRole: "Spinner",
          tailwindClasses: ["animate-spin", "mr-2", "h-4", "w-4"]
        }
      ]
    }
  }
}
11.2.3 Rendering States in Figma
Approach: Create multiple artboards showing each state side-by-side
typescript
function renderWithStates(rsnt: RSNT_Node): FrameNode {
  const container = figma.createFrame()
  container.name = `${rsnt.semanticRole} - All States`
  container.layoutMode = 'HORIZONTAL'
  container.itemSpacing = 40
  
  // Render default state
  const defaultState = renderNode(rsnt)
  defaultState.name = 'Default'
  container.appendChild(defaultState)
  
  // Render each state variant
  if (rsnt.stateVariants) {
    for (const [stateName, stateOverride] of Object.entries(rsnt.stateVariants)) {
      const stateRSNT = mergeRSNT(rsnt, stateOverride)
      const stateNode = renderNode(stateRSNT)
      stateNode.name = capitalize(stateName)
      
      // Add label above
      const label = figma.createText()
      label.characters = stateName
      label.fontSize = 12
      
      const stateGroup = figma.createFrame()
      stateGroup.layoutMode = 'VERTICAL'
      stateGroup.itemSpacing = 8
      stateGroup.appendChild(label)
      stateGroup.appendChild(stateNode)
      
      container.appendChild(stateGroup)
    }
  }
  
  return container
}
Result in Figma:
[Default]  [Hover]    [Focus]    [Disabled]  [Loading]
  Submit    Submit     Submit     Submit      ⟳ Submitting...
11.2.4 Code Export for States
CSS Pseudo-Classes (Interactive States):
typescript
function exportInteractiveStates(rsnt: RSNT_Node): string {
  const baseClasses = rsnt.tailwindClasses
  const hoverClasses = rsnt.stateVariants?.hover?.tailwindClasses || []
  const focusClasses = rsnt.stateVariants?.focus?.tailwindClasses || []
  const activeClasses = rsnt.stateVariants?.active?.tailwindClasses || []
  
  const allClasses = [
    ...baseClasses,
    ...hoverClasses.map(c => `hover:${c}`),
    ...focusClasses.map(c => `focus:${c}`),
    ...activeClasses.map(c => `active:${c}`)
  ]
  
  return allClasses.join(' ')
}
Output:
tsx
<button className="px-4 py-2 bg-primary text-white hover:bg-primary-600 focus:ring-2 focus:ring-primary active:bg-primary-700">
  Submit
</button>
Conditional Rendering (Status States):
typescript
function exportStatusStates(rsnt: RSNT_Node): string {
  const hasLoading = rsnt.stateVariants?.loading
  const hasError = rsnt.stateVariants?.error
  
  if (hasLoading) {
    return `
{isLoading ? (
  <Button disabled>
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    ${rsnt.stateVariants.loading.props?.label || 'Loading...'}
  </Button>
) : (
  <Button>${rsnt.props.label}</Button>
)}
    `.trim()
  }
  
  if (hasError) {
    return `
<div>
  <Button className={\`\${hasError ? 'border-destructive' : ''}\`}>
    ${rsnt.props.label}
  </Button>
  {hasError && <p className="text-sm text-destructive">{errorMessage}</p>}
</div>
    `.trim()
  }
  
  return `<Button>${rsnt.props.label}</Button>`
}
Output:
tsx
{isLoading ? (
  <Button disabled>
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    Submitting...
  </Button>
) : (
  <Button>Submit</Button>
)}
11.3 Conditional Rendering System
11.3.1 Conditional Expression Types
Boolean Check:
typescript
{
  type: 'boolean',
  variable: 'hasError'
}
// Code: {hasError && <Alert />}
Comparison:
typescript
{
  type: 'comparison',
  left: 'itemCount',
  operator: '>',
  right: 0
}
// Code: {itemCount > 0 && <DataList />}
Compound (Multiple Conditions):
typescript
{
  type: 'compound',
  logic: 'AND',
  conditions: [
    { type: 'boolean', variable: 'isLoggedIn' },
    { type: 'comparison', left: 'userRole', operator: '==', right: 'admin' }
  ]
}
// Code: {isLoggedIn && userRole === 'admin' && <AdminPanel />}
11.3.2 Figma Rendering for Conditionals
Show both states with visual distinction:
typescript
function renderConditional(rsnt: RSNT_Node): FrameNode {
  const container = figma.createFrame()
  container.name = `Conditional: ${rsnt.conditionalRender.showIf.variable}`
  container.layoutMode = 'VERTICAL'
  container.itemSpacing = 20
  
  // Render "shown" state
  const shownNode = renderNode(rsnt)
  shownNode.name = '✓ Shown (when condition true)'
  container.appendChild(shownNode)
  
  // Render fallback (if exists)
  if (rsnt.conditionalRender.fallback) {
    const fallbackNode = renderNode(rsnt.conditionalRender.fallback)
    fallbackNode.name = '✗ Hidden (when condition false)'
    fallbackNode.opacity = 0.5 // Visual indicator
    container.appendChild(fallbackNode)
  } else {
    // Show placeholder
    const placeholder = figma.createText()
    placeholder.characters = '(Nothing shown when condition false)'
    placeholder.opacity = 0.5
    container.appendChild(placeholder)
  }
  
  return container
}
11.3.3 Code Export for Conditionals
typescript
function exportConditional(rsnt: RSNT_Node): string {
  const condition = generateCondition(rsnt.conditionalRender.showIf)
  const element = generateElement(rsnt)
  
  if (rsnt.conditionalRender.fallback) {
    const fallbackElement = generateElement(rsnt.conditionalRender.fallback)
    return `{${condition} ? (\n  ${element}\n) : (\n  ${fallbackElement}\n)}`
  } else {
    return `{${condition} && (\n  ${element}\n)}`
  }
}

function generateCondition(expr: ConditionalExpression): string {
  switch (expr.type) {
    case 'boolean':
      return expr.variable
    case 'comparison':
      return `${expr.left} ${expr.operator} ${JSON.stringify(expr.right)}`
    case 'compound':
      const subs = expr.conditions.map(c => generateCondition(c))
      return `(${subs.join(` ${expr.logic === 'AND' ? '&&' : '||'} `)})`
  }
}
Examples:
tsx
// Boolean
{hasError && (
  <Alert variant="destructive">Error occurred</Alert>
)}

// Comparison
{items.length > 0 ? (
  <DataList items={items} />
) : (
  <EmptyState message="No items" />
)}

// Compound
{isLoggedIn && userRole === 'admin' && (
  <AdminPanel />
)}
11.4 Dynamic Content Placeholders
11.4.1 Variable Text
In RSNT:
typescript
{
  semanticRole: "Heading",
  props: {
    text: "{userName}",  // Dynamic placeholder
    isDynamic: true
  }
}
Figma Rendering:
Shows: {userName}
Code Export:
tsx
<h2>{userName}</h2>
11.4.2 List Iteration
In RSNT:
typescript
{
  semanticRole: "List",
  props: {
    itemsSource: "products",  // Collection name
    isDynamic: true
  },
  children: [
    {
      semanticRole: "ListItem",
      props: {
        isTemplate: true  // This is the template, will be repeated
      }
    }
  ]
}
Figma Rendering:
Shows 3 example items with note:
"Template - will repeat for each item in 'products'"
Code Export:
tsx
<ul>
  {products.map((product, index) => (
    <li key={index}>
      {product.name}
    </li>
  ))}
</ul>
11.5 Form State Handling
11.5.1 Form-Level State
Generated state variables:
tsx
const [formData, setFormData] = useState({
  email: '',
  password: ''
})
const [errors, setErrors] = useState<Record<string, string>>({})
const [isSubmitting, setIsSubmitting] = useState(false)
11.5.2 Field-Level State
For each field:
tsx
<div>
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    value={formData.email}
    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
    className={errors.email ? 'border-destructive' : ''}
    disabled={isSubmitting}
  />
  {errors.email && (
    <p className="text-sm text-destructive">{errors.email}</p>
  )}
</div>
11.5.3 Submit Handler
tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsSubmitting(true)
  setErrors({})
  
  // Validation
  const newErrors: Record<string, string> = {}
  if (!formData.email) {
    newErrors.email = 'Email is required'
  }
  if (!formData.password) {
    newErrors.password = 'Password is required'
  }
  
  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors)
    setIsSubmitting(false)
    return
  }
  
  try {
    // Submit logic
    await submitForm(formData)
  } catch (error) {
    setErrors({ submit: 'Failed to submit' })
  } finally {
    setIsSubmitting(false)
  }
}

12. Responsive Design Handling
12.1 The Responsive Challenge
Problem: Figma designs are fixed-width, real UIs adapt to screen sizes.
Solution: Define responsive behavior in RSNT, render multiple breakpoint previews in Figma, export mobile-first Tailwind.
12.2 Breakpoint System
Standard Breakpoints:
typescript
const breakpoints = {
  mobile: {
    min: 0,
    max: 639,
    prefix: '' // No prefix (mobile-first)
  },
  tablet: {
    min: 640,
    max: 1023,
    prefix: 'md:'
  },
  desktop: {
    min: 1024,
    max: Infinity,
    prefix: 'lg:'
  }
}
12.3 RSNT Responsive Structure
typescript
{
  id: "card-001",
  semanticRole: "Card",
  layoutPrimitive: "stack-v",
  
  // Base (mobile) classes
  tailwindClasses: ["p-4", "gap-3"],
  
  // Responsive overrides
  responsive: {
    tablet: {
      tailwindClasses: ["p-6", "gap-4"]
    },
    desktop: {
      tailwindClasses: ["p-8", "gap-6"],
      layoutPrimitive: "stack-h" // Change layout on desktop!
    }
  }
}
12.4 Figma Rendering
Create frames at different viewport widths:
typescript
function renderResponsive(rsnt: RSNT_Node): FrameNode {
  const container = figma.createFrame()
  container.name = `${rsnt.semanticRole} - Responsive`
  container.layoutMode = 'HORIZONTAL'
  container.itemSpacing = 60
  
  // Mobile (375px)
  const mobileFrame = figma.createFrame()
  mobileFrame.resize(375, 0)
  mobileFrame.name = 'Mobile (375px)'
  const mobileContent = renderNode(rsnt) // Uses base classes
  mobileFrame.appendChild(mobileContent)
  container.appendChild(mobileFrame)
  
  // Tablet (768px)
  const tabletFrame = figma.createFrame()
  tabletFrame.resize(768, 0)
  tabletFrame.name = 'Tablet (768px)'
  const tabletRSNT = mergeRSNT(rsnt, rsnt.responsive?.tablet || {})
  const tabletContent = renderNode(tabletRSNT)
  tabletFrame.appendChild(tabletContent)
  container.appendChild(tabletFrame)
  
  // Desktop (1440px)
  const desktopFrame = figma.createFrame()
  desktopFrame.resize(1440, 0)
  desktopFrame.name = 'Desktop (1440px)'
  const desktopRSNT = mergeRSNT(rsnt, rsnt.responsive?.desktop || {})
  const desktopContent = renderNode(desktopRSNT)
  desktopFrame.appendChild(desktopContent)
  container.appendChild(desktopFrame)
  
  return container
}
Result:
┌─────────┐  ┌──────────────┐  ┌────────────────────────┐
│ Mobile  │  │   Tablet     │  │       Desktop          │
│ 375px   │  │   768px      │  │       1440px           │
│         │  │              │  │                        │
│ Content │  │   Content    │  │  Content with more     │
│ stacks  │  │   more space │  │  space & horizontal    │
│         │  │              │  │  layout                │
└─────────┘  └──────────────┘  └────────────────────────┘
12.5 Code Export (Mobile-First)
typescript
function exportResponsiveClasses(rsnt: RSNT_Node): string {
  const classes: string[] = []
  
  // Base (mobile) - no prefix
  classes.push(...rsnt.tailwindClasses)
  
  // Tablet - md: prefix
  if (rsnt.responsive?.tablet?.tailwindClasses) {
    const tabletClasses = rsnt.responsive.tablet.tailwindClasses
      .map(c => `md:${c}`)
    classes.push(...tabletClasses)
  }
  
  // Desktop - lg: prefix
  if (rsnt.responsive?.desktop?.tailwindClasses) {
    const desktopClasses = rsnt.responsive.desktop.tailwindClasses
      .map(c => `lg:${c}`)
    classes.push(...desktopClasses)
  }
  
  return classes.join(' ')
}
Example Output:
tsx
<Card className="p-4 gap-3 md:p-6 md:gap-4 lg:p-8 lg:gap-6">
  <h2 className="text-2xl md:text-3xl lg:text-4xl">Heading</h2>
</Card>
12.6 Layout Changes
Example: Stack vertically on mobile, horizontally on desktop
typescript
// RSNT
{
  layoutPrimitive: "stack-v",  // Mobile
  responsive: {
    desktop: {
      layoutPrimitive: "stack-h"  // Desktop
    }
  }
}

// Code Export
<div className="flex flex-col lg:flex-row gap-4">
  {/* Content */}
</div>
12.7 Hide/Show Elements
typescript
// RSNT - Hide on mobile, show on desktop
{
  tailwindClasses: ["hidden", "lg:block"]
}

// RSNT - Show on mobile, hide on desktop
{
  tailwindClasses: ["block", "lg:hidden"]
}
12.8 Designer Controls
Responsive Settings UI:
┌──────────────────────────────────────────────────────────┐
│ Responsive Behavior                                       │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ Breakpoint: [Desktop (≥1024px) ▼]                       │
│                                                           │
│ Overrides for this breakpoint:                           │
│ ☑ Change padding to p-8                                  │
│ ☑ Change layout to horizontal                            │
│ ☐ Hide this element                                      │
│ ☑ Change text size to text-4xl                           │
│                                                           │
│ [Add Override] [Clear All]                               │
│                                                           │
└──────────────────────────────────────────────────────────┘

13. Version Control & Migration
13.1 Versioning Strategy
What Gets Versioned:
Rule library (overall version)
Individual rules (semantic versioning each)
Presets (follow source library versions)
RSNT schema (rare, only on breaking changes)
Plugin itself (standard semver)
13.2 Semantic Versioning
Format: MAJOR.MINOR.PATCH
When to Bump:
MAJOR: Breaking changes (remove properties, change structure)
MINOR: New features (add optional properties)
PATCH: Bug fixes (no functional changes)
Example:
Rule: "Login Card Pattern"
- v1.0.0: Initial release
- v1.1.0: Added optional "remember me" checkbox (MINOR)
- v1.1.1: Fixed spacing bug (PATCH)
- v2.0.0: Changed required structure (MAJOR)
13.3 Version Storage
Per-Design Metadata:
typescript
// Stored in figma.root.getPluginData('generation-metadata')
{
  generatedWith: {
    pluginVersion: "1.2.0",
    rsntSchemaVersion: "1.0.0",
    ruleLibraryVersion: "2.3.1",
    presetVersion: "shadcn-v1.3.0",
    timestamp: "2026-01-27T10:30:00Z"
  },
  rulesUsed: [
    { ruleId: "login-card-001", version: "1.2.0" },
    { ruleId: "form-field-002", version: "2.0.1" }
  ]
}
13.4 Version Locking Strategies
Option 1: Lock to Current (Default, Safest)
Design uses rule v1.2.0
Rule updates to v1.3.0
Designer must manually upgrade
Option 2: Auto-Update Minor
Design uses rule v1.2.0
Rule updates to v1.3.0 → Auto-update ✓
Rule updates to v2.0.0 → Requires manual approval
Option 3: Auto-Update All (Risky)
Design always uses latest version
May break on major updates
13.5 Migration System
13.5.1 Migration Flow
1. Detect version mismatch
   ↓
2. Calculate changes needed
   ↓
3. Show preview (old vs new)
   ↓
4. Designer approves/rejects
   ↓
5. Execute migration
   ↓
6. Update metadata
   ↓
7. Keep backup for 30 days
13.5.2 Migration UI
┌──────────────────────────────────────────────────────────┐
│ Rule Update Available                                     │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ "Login Card Pattern" has a new version                   │
│ Current: v1.2.0                                           │
│ Latest: v2.0.0                                            │
│                                                           │
│ Changes:                                                  │
│ ⚠ BREAKING: Padding changed (24px → 32px)               │
│ ✓ Added: Optional social login buttons                   │
│ ✓ Fixed: Mobile spacing issue                            │
│                                                           │
│ ┌─────────────────┐  ┌─────────────────┐                │
│ │   Current       │  │   After Update  │                │
│ │   (v1.2.0)      │  │   (v2.0.0)      │                │
│ │  [Preview]      │  │  [Preview]      │                │
│ └─────────────────┘  └─────────────────┘                │
│                                                           │
│ Impact: 12 designs use this rule                         │
│                                                           │
│ [Update] [Keep Current] [View Details]                   │
│                                                           │
└──────────────────────────────────────────────────────────┘
13.5.3 Rollback Support
typescript
// Before migration, create backup
const backup = {
  timestamp: new Date().toISOString(),
  originalRSNT: extractRSNT(node),
  originalRules: getRulesUsed(node),
  figmaSnapshot: node.clone()
}

// Store backup
figma.root.setPluginData(
  `migration-backup-${node.id}`,
  JSON.stringify(backup)
)

// Auto-delete after 30 days
setTimeout(() => {
  figma.root.setPluginData(`migration-backup-${node.id}`, '')
}, 30 * 24 * 60 * 60 * 1000)
Rollback UI:
Recent Migrations:
- Login Card - Updated 2 hours ago [Rollback]
- Form Field - Updated yesterday [Rollback]
13.6 Preset Version Management
When preset updates (e.g., Shadcn v1.3.0 → v1.4.0):
┌──────────────────────────────────────────────────────────┐
│ Shadcn UI Update Available                                │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ Shadcn UI v1.4.0 is now available                        │
│ You're using: v1.3.0                                      │
│                                                           │
│ What's New:                                               │
│ • New Toast component                                     │
│ • Updated Button hover states                             │
│ • Changed default border radius (8px → 6px)              │
│                                                           │
│ Update strategy:                                          │
│ ○ Update all existing designs (may cause changes)        │
│ ● Use new version for new designs only (recommended)     │
│ ○ Don't update (continue using v1.3.0)                   │
│                                                           │
│ [Apply]                                                   │
│                                                           │
└──────────────────────────────────────────────────────────┘

14. Performance Specifications
14.1 Performance Requirements
Target Metrics:
typescript
interface PerformanceTargets {
  // Generation Time
  simple: '<500ms',      // 5-10 nodes
  medium: '<2s',         // 20-50 nodes
  complex: '<5s',        // 50-100 nodes
  veryLarge: '<10s',     // 100-200 nodes
  
  // Discovery
  initialScan: '<10s',   // 200 components uncached
  cachedScan: '<100ms',  // Cache hit
  
  // AI Response
  simple: '1-3s',        // Simple intent
  complex: '3-7s',       // Complex intent
  maximum: '<10s',       // Absolute max
  
  // UI Responsiveness
  inputDelay: '<50ms',   // Typing in UI
  buttonClick: '<100ms', // Button response
  progressUpdate: '200ms' // Progress bar refresh
}
14.2 Caching Strategy
14.2.1 Discovery Cache
typescript
interface DiscoveryCache {
  componentFingerprints: Map<string, ComponentFingerprint>
  variableInventory: Map<string, Variable>
  approvedMappings: Map<string, string>
  fileVersion: string
  timestamp: number
  ttl: 24 * 60 * 60 * 1000 // 24 hours
}

// Storage
figma.clientStorage.setAsync('discovery-cache', cache)

// Invalidation
if (cache.timestamp + cache.ttl < Date.now()) {
  // Expired, rescan
}
if (cache.fileVersion !== figma.fileKey) {
  // Different file, rescan
}
14.2.2 Resolution Cache
typescript
// Cache successful resolutions per session
const resolutionCache = new Map<string, ResolutionResult>()

function getCacheKey(rsnt: RSNT_Node): string {
  return `${rsnt.semanticRole}-${JSON.stringify(rsnt.props)}`
}

// Check cache before resolving
const cacheKey = getCacheKey(rsntNode)
if (resolutionCache.has(cacheKey)) {
  return resolutionCache.get(cacheKey)
}

// Resolve and cache
const result = await resolveNode(rsntNode)
resolutionCache.set(cacheKey, result)
14.2.3 Component Import Cache
typescript
// Cache component imports
const componentCache = new Map<string, ComponentNode>()

async function getComponent(componentId: string): Promise<ComponentNode> {
  if (componentCache.has(componentId)) {
    return componentCache.get(componentId)
  }
  
  const component = await figma.importComponentByKeyAsync(componentId)
  componentCache.set(componentId, component)
  return component
}
14.3 Batching & Chunking
typescript
async function executeBatched(nodes: RSNT_Node[]): Promise<void> {
  const BATCH_SIZE = 25
  const YIELD_INTERVAL = 0 // Yield every batch
  
  for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
    const batch = nodes.slice(i, i + BATCH_SIZE)
    
    // Process batch
    await Promise.all(batch.map(node => processNode(node)))
    
    // Update progress
    const progress = Math.round(((i + batch.length) / nodes.length) * 100)
    updateProgress(progress)
    
    // Yield to main thread
    await new Promise(resolve => setTimeout(resolve, YIELD_INTERVAL))
  }
}
14.4 Performance Monitoring
typescript
interface PerformanceMetrics {
  generationId: string
  timestamp: string
  
  timings: {
    total: number
    discovery: number
    aiOrchestration: number
    resolution: number
    execution: number
    export?: number
  }
  
  counts: {
    totalNodes: number
    componentsUsed: number
    variablesResolved: number
    conflictsDetected: number
  }
  
  cache: {
    discoveryHit: boolean
    resolutionHitRate: number
  }
  
  warnings: string[]
  errors: string[]
}

// Log after each generation
logPerformanceMetrics(metrics)

// Aggregate weekly
calculateAverages(lastWeekMetrics)
14.5 Large File Optimization
For files with 1000+ components:
typescript
async function scanLargeFile(): Promise<DiscoveryData> {
  const totalComponents = countComponents()
  
  if (totalComponents < 200) {
    // Normal scan
    return await fullScan()
  }
  
  // Large file strategy
  console.log(`Large file detected (${totalComponents} components)`)
  
  // 1. Scan current page first (fast)
  const currentPageScan = await scanPage(figma.currentPage)
  
  // 2. Show partial results immediately
  showPartialResults(currentPageScan)
  
  // 3. Continue scanning other pages in background
  const backgroundPromise = scanOtherPages()
  
  // 4. Update results as background scan completes
  backgroundPromise.then(fullResults => {
    updateDiscoveryResults(fullResults)
  })
  
  return currentPageScan
}

15. Designer Approval Flows
15.1 Approval Decision Tree
User submits intent
    ↓
AI generates RSNT
    ↓
Calculate confidence
    ↓
    ├─ Confidence ≥ 0.9 → Auto-execute
    │                     (show success notification)
    │
    ├─ 0.6 ≤ Confidence < 0.9 → Ghost Preview
    │                            (semi-transparent, request approval)
    │
    └─ Confidence < 0.6 → Clarification Questions
                          (don't render, ask for more info)
15.2 Ghost Preview Pattern
When: Confidence between 0.6 and 0.89
Visual:
typescript
function renderGhostPreview(rsnt: RSNT_Node): FrameNode {
  const ghost = renderNode(rsnt)
  
  // Make semi-transparent
  ghost.opacity = 0.6
  
  // Lock to prevent editing
  ghost.locked = true
  
  // Add label
  ghost.name = '👻 Preview (awaiting approval)'
  
  // Add approval indicator
  const badge = createBadge('Needs Approval')
  ghost.appendChild(badge)
  
  return ghost
}
Approval Dialog:
┌──────────────────────────────────────────────────────────┐
│ Review Generated Design                                   │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ Confidence: 85% (Good)                                   │
│                                                           │
│ What I created:                                           │
│ • Login card with email/password fields                  │
│ • Submit button (primary)                                 │
│ • Forgot password link                                    │
│                                                           │
│ Highlighted Decisions:                                    │
│ ✓ Used your Button component                            │
│ ⚠ Card padding: Used p-6 (preset) instead of p-8 (rule)│
│ ✓ Applied Shadcn styling                                 │
│                                                           │
│ Warnings:                                                 │
│ ⚠ 1 conflict auto-resolved (click to review)            │
│                                                           │
│ [Looks Good ✓] [Adjust First] [Start Over]              │
│                                                           │
└──────────────────────────────────────────────────────────┘
15.3 Clarification Questions
When: Confidence < 0.6
Don't render anything, ask questions instead:
┌──────────────────────────────────────────────────────────┐
│ I need more information                                   │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ Your request: "Create a card for user info"             │
│                                                           │
│ I'm not sure about some details. Can you clarify:       │
│                                                           │
│ 1. What information should be in the card?               │
│    ○ Basic (name, email)                                 │
│    ○ Detailed (name, email, avatar, bio)                │
│    ○ Custom (specify below)                              │
│    [_____________________________________]                │
│                                                           │
│ 2. Should it have any actions (buttons)?                 │
│    ☑ Yes  ☐ No                                          │
│    If yes: [Edit, Delete_____________]                   │
│                                                           │
│ 3. Where will this be used?                              │
│    ● User profile page                                   │
│    ○ Admin dashboard                                     │
│    ○ Other: [______________]                            │
│                                                           │
│ [Regenerate with Info] [Rephrase Request] [Choose Preset]│
│                                                           │
└──────────────────────────────────────────────────────────┘
15.4 Conflict Report
After generation, if conflicts occurred:
⚠️ 3 conflicts auto-resolved [Click to review]

┌──────────────────────────────────────────────────────────┐
│ Conflict Resolution Report                                │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ Property      │ Your Rule │ Component │ Used     │ Why   │
│───────────────│───────────│───────────│──────────│───────│
│ Button.height │ 40px      │ 44px      │ 44px ✓  │ P1    │
│ Card.padding  │ 16px      │ --        │ 24px ✓  │ P2    │
│ Input.radius  │ 6px       │ 8px       │ 8px ✓   │ P1    │
│                                                           │
│ P1 = Component priority (respects client design)        │
│ P2 = Preset priority (Shadcn conventions)                │
│                                                           │
│ Actions for each conflict:                                │
│ [This is fine] [Always use my rules] [Edit component]   │
│                                                           │
└──────────────────────────────────────────────────────────┘
15.5 Variable Match Approval
When variable confidence < 0.8:
┌──────────────────────────────────────────────────────────┐
│ Review Variable Matches                                   │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ 3 variables need your approval:                          │
│                                                           │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Looking for: colors/primary                        │  │
│ │ Best match: brand-primary (75% confident)          │  │
│ │ [#3B82F6] → [#0EA5E9]                             │  │
│ │ Color difference: ΔE = 4.2 (acceptable)           │  │
│ │                                                     │  │
│ │ [✓ Use] [Pick Different] [Skip]                   │  │
│ └────────────────────────────────────────────────────┘  │
│                                                           │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Looking for: spacing/4                             │  │
│ │ Best match: space-md (70% confident)               │  │
│ │ 16px → 16px (exact value match)                   │  │
│ │                                                     │  │
│ │ [✓ Use] [Pick Different] [Skip]                   │  │
│ └────────────────────────────────────────────────────┘  │
│                                                           │
│ [Approve All >70%] [Review Each]                         │
│                                                           │
└──────────────────────────────────────────────────────────┘

16. Security & Privacy
16.1 Data Handling Principles
Core Commitments:
No design data for AI training
No design data stored externally (except temporary API calls)
No user data shared with third parties
Minimal data collection
Transparent usage
16.2 AI Processing
What is sent to Anthropic API:
User intent (text prompt)
Rule library (rules being used)
Preset selection (e.g., "Shadcn")
Context (platform, constraints)
What is NOT sent:
Actual Figma file contents
Client component designs
Variable values
Designer's name
Project/file names
Any client-specific visual data
Retention:
Anthropic: Requests logged temporarily for debugging, auto-deleted after 30 days
Not used for training (per Anthropic policy)
Offline Mode:
Option to disable AI completely
Uses local rule engine only
Designer selects components manually
16.3 Local Storage
Figma clientStorage (24hr TTL):
Discovery cache
Approved variable mappings
Conflict preferences
Last used preset
Figma pluginData (permanent):
RSNT metadata (per node)
Generation metadata
Designer preferences
Nothing stored externally
16.4 Network Security
All API calls:
HTTPS only
API key stored securely
Rate limiting applied
Allowed domains: api.anthropic.com only
No tracking:
No third-party analytics
No external trackers
Optional anonymized usage metrics (with consent)
16.5 Compliance
GDPR:
No personal data collected without consent
Data deletion on request
Privacy policy available
CCPA:
Opt-out for California residents
No sale of personal information
SOC 2:
Anthropic API is SOC 2 compliant
Plugin follows security best practices
16.6 Sensitive Information
Best Practices:
Designer should avoid entering sensitive info in prompts
Use placeholders: "Create login for [Company Name]"
Plugin can sanitize before sending (optional setting)
Sanitization Example:
typescript
function sanitizeIntent(intent: string): string {
  // Replace specific names
  return intent
    .replace(/for \w+ (Inc|Corp|LLC)/g, 'for [Company]')
    .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[Name]') // Names
}
16.7 Audit Logging
What is logged locally:
Generation events (timestamp, type)
Conflict resolutions (which rule won)
Approval decisions (approved/rejected)
Performance metrics
NOT logged:
Actual design content
Client-specific information
Sensitive text
Access:
Designer can view logs in Settings
Designer can clear logs anytime

17. Implementation Roadmap
17.1 12-Month Timeline
Phase 1: MVP (Months 1-3)
Goal: Prove core concept works
Features:
Basic RSNT schema
AI orchestration (Claude API integration)
Simple rule library (10-15 pre-built patterns)
Tier 1 resolution only (library components)
Basic execution engine
Simple code export (React + Tailwind, no states)
High-confidence auto-execution only
Limitations:
No Discovery (manual component mapping)
No multi-tier fallback
No state variants
No responsive
No conflict resolution
No version control
Success Criteria:
Generate simple designs (buttons, cards, forms)
90% accuracy for well-defined intents
<5 seconds for 20-node designs
Phase 2: Enhanced Resolution (Months 4-5)
Goal: Work in any file without setup
Features:
Discovery Service (fingerprinting, variable scanning)
5-tier resolution fallback
Variable resolution (exact + semantic + proximity)
Approval flows (ghost preview, clarifications)
Conflict detection and resolution
Variable match approval UI
Success Criteria:
Works in files without manual setup
Generates even without perfect component matches
80% variable matching accuracy
Phase 3: Advanced Features (Months 6-8)
Goal: Production-quality designs with state/responsive
Features:
State variants (hover, focus, disabled, loading, error)
Conditional rendering
Responsive behavior (mobile/tablet/desktop)
Adjustment panel (edit RSNT in UI)
Enhanced code export (includes state management, event handlers)
Performance optimizations (caching, batching)
Success Criteria:
Generate complex interactive designs
Code export includes state logic
Handle 100 nodes in <5 seconds
Phase 4: Rule Authoring & Versioning (Months 9-10)
Goal: Designers create custom rules
Features:
Record Mode (analyze designs to extract rules)
Rule library management
Version control (semantic versioning)
Migration tools with preview
Preset system (Shadcn, Radix, custom)
Conflict preferences (persistent overrides)
Success Criteria:
Designers can create rules without coding
Rules evolve without breaking old designs
Migration works smoothly
Phase 5: Polish & Scale (Months 11-12)
Goal: Production-ready, team features
Features:
Team library integration (shared rules)
Advanced code export (Vue, TypeScript, Storybook)
Comprehensive error handling
Documentation (user guide, API reference, video tutorials)
Tutorial/onboarding flow
Analytics and monitoring
Success Criteria:
Enterprise-ready quality
<1% error rate
Handles 1000+ component libraries
Positive user feedback
17.2 Resource Requirements
Team (6-8 people):
Senior Frontend Engineer (TypeScript, React)
AI/ML Engineer (prompt engineering, Claude API)
Product Designer (UX for plugin)
QA Engineer (testing)
Frontend Engineer (Month 6+)
Backend Engineer (Month 6+, for team features)
Technical Writer (Month 9+)
DevOps Engineer (Month 11+, part-time)
Technology:
TypeScript
Figma Plugin API
Claude 3.5 Sonnet
Vite (build)
Jest (testing)
Playwright (E2E testing)
GitHub Actions (CI/CD)
Sentry (error tracking)
Mixpanel (analytics, optional)
Infrastructure:
Anthropic API costs: $50-500/month (depends on usage)
No server infrastructure needed (serverless via API)
GitHub Pages (documentation)
17.3 Testing Strategy
Unit Tests:
RSNT validation
Layout primitive translation
Variable resolution
Conflict resolution
Code generation
Integration Tests:
End-to-end generation flows
Discovery → Resolution → Execution pipeline
API integration (mocked)
Visual Regression Tests:
Compare generated output to golden masters
Detect unintended visual changes
User Testing:
Alpha (internal): Month 2-3
Beta (external, 10 users): Month 4-6
Public beta (100+ users): Month 7-9
Production: Month 12
Performance Testing:
Load testing (large files)
Stress testing (complex generations)
Benchmark tracking
17.4 Go-to-Market Strategy
Pre-Launch (Months 1-11):
Build in public (Twitter/X, LinkedIn)
Progress videos every 2 weeks
Early access signups
Partner with design communities
Launch (Month 12):
Product Hunt launch
Social media campaign
Design influencer partnerships
Press outreach (TechCrunch, The Verge)
Post-Launch:
Weekly office hours
Monthly feature updates
Quarterly major releases
Annual design conference presence
Pricing (if monetized):
Free tier: 10 generations/month
Pro: $10/month (unlimited generations)
Team: $30/month per seat (shared rule libraries)
Enterprise: Custom pricing (SLA, support, private deployment)

18. Appendices
18.1 Complete RSNT Schema (TypeScript)
typescript
interface RSNT_Node {
  id: string
  semanticRole: SemanticRole
  layoutPrimitive: LayoutPrimitive
  tailwindClasses: string[]
  props: Record<string, any>
  children?: RSNT_Node[]
  constraints: {
    width: 'hug' | 'fill' | 'fixed'
    height: 'hug' | 'fill' | 'fixed'
    minWidth?: number
    maxWidth?: number
    minHeight?: number
    maxHeight?: number
  }
  stateVariants?: {
    hover?: Partial<RSNT_Node>
    focus?: Partial<RSNT_Node>
    active?: Partial<RSNT_Node>
    disabled?: Partial<RSNT_Node>
    error?: Partial<RSNT_Node>
    loading?: Partial<RSNT_Node>
  }
  conditionalRender?: {
    showIf: ConditionalExpression
    fallback?: RSNT_Node
  }
  responsive?: {
    mobile?: Partial<RSNT_Node>
    tablet?: Partial<RSNT_Node>
    desktop?: Partial<RSNT_Node>
  }
  metadata: {
    source: 'ai' | 'recorded' | 'manual'
    ruleVersion: string
    presetUsed?: string
    createdAt: string
    confidence?: number
  }
}

type SemanticRole = string // 60+ approved roles
type LayoutPrimitive = string // 20+ approved primitives

interface ConditionalExpression {
  type: 'boolean' | 'comparison' | 'compound'
  variable?: string
  left?: string
  operator?: '==' | '!=' | '>' | '<' | '>=' | '<='
  right?: string | number | boolean
  conditions?: ConditionalExpression[]
  logic?: 'AND' | 'OR'
}
18.2 Performance Benchmarks
Operation
Target
Actual (Expected)
Simple generation (10 nodes)
<500ms
300-450ms
Medium generation (50 nodes)
<2s
1.2-1.8s
Complex generation (100 nodes)
<5s
3.5-4.5s
Discovery (uncached, 200 components)
<10s
8-12s
Discovery (cached)
<100ms
50-80ms
AI response (simple)
1-3s
1.5-2.5s
AI response (complex)
3-7s
4-6s

18.3 Error Codes
1000-1999: RSNT Validation Errors
1001: Invalid semantic role
1002: Invalid layout primitive
1003: Missing required property
1004: Circular dependency
1005: Exceeds max depth
2000-2999: AI Orchestration Errors
2001: API request failed
2002: Invalid JSON response
2003: Schema validation failed
2004: Confidence too low
2005: Timeout
3000-3999: Discovery Errors
3001: No components found
3002: No variables found
3003: Fingerprinting failed
3004: Cache corrupted
4000-4999: Resolution Errors
4001: No resolution found (all tiers failed)
4002: Component not found
4003: Variable not found
4004: Mapping failed
5000-5999: Execution Errors
5001: Node creation failed
5002: Layout application failed
5003: Property binding failed
5004: Generation cancelled
6000-6999: Code Export Errors
6001: No RSNT metadata found
6002: Export format invalid
6003: Code generation failed
6004: Validation failed
18.4 Glossary
AI Orchestration Service: Service that translates natural language into RSNT using Claude API
Anatomy Signature: Structural fingerprint of a component (layer types, counts, nesting)
CIELAB Color Space: Perceptually uniform color space used for color matching (Delta E)
Conflict: When multiple sources specify different values for same property
Conditional Rendering: Showing/hiding elements based on runtime conditions
Creator Rules: Designer-defined patterns and conventions
Delta E (ΔE): Perceptual color difference measurement in CIELAB space
Discovery Service: Automatically scans and maps client components/variables
Execution Service: Creates actual Figma nodes from resolved instructions
Fallback Hierarchy: 5-tier system for resolving semantic elements to implementations
Fingerprinting: Process of analyzing components to infer semantic meaning
Ghost Preview: Semi-transparent preview requiring designer approval
Layout Primitive: Standardized structural pattern (stack-v, flex-center, etc.)
Preset: Pre-configured rule set for specific design system (Shadcn, Radix)
Priority Hierarchy: Order for conflict resolution (Component > Preset > Creator > System)
Resolution Service: Maps RSNT nodes to implementation strategies
RSNT (Recursive Semantic Node Tree): Platform-agnostic design structure representation
Rule Library: Collection of designer-defined patterns and conventions
Semantic Role: What an element IS (PrimaryButton, Card, FormField)
Semantic Token: Design system variable (colors/primary, spacing/4)
State Variant: Alternative appearance/behavior for different states (hover, disabled)
Tailwind Classes: Utility classes defining styling (p-4, bg-primary, rounded-md)
Tier 1-5: Resolution strategies (Library Match → System Default)
18.5 FAQ
Q: Does the AI design for me? A: No. The AI only translates your intent into structured data. All design decisions come from your rules.
Q: Will my designs be used to train AI? A: No. Only your text prompts are sent to Anthropic's API, and they don't use that data for training.
Q: Can I use the plugin offline? A: Yes. Enable "Offline Mode" to use local rules only (without AI).
Q: Does it work with my design system? A: Yes. The Discovery Service automatically analyzes any design system.
Q: What if my component properties have different names? A: The AI maps them semantically. E.g., "Type: Filled" → "variant: primary"
Q: Can I create my own rules? A: Yes. Use Record Mode, import from docs, or create manually.
Q: How do I update designs when rules change? A: Migration tools let you preview changes before applying.
Q: Is the generated code production-ready? A: Yes. It's valid React/Tailwind matching your Figma design exactly.
Q: What happens when there are conflicts? A: Component designs win over rules (respects your existing components).
Q: Can multiple designers use the same rules? A: Yes. Share via Team Libraries (Phase 5 feature).

