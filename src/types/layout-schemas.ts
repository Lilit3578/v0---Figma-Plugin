// types/layout-schemas.ts

import { RSNT_Node } from './rsnt';

/**
 * Layout pattern types
 */
export type LayoutPattern =
    | 'desktop_default'
    | 'two_column'
    | 'sidebar_main'
    | 'dashboard_grid'
    | 'three_column'
    | 'split_view'
    | 'header_content_footer';

/**
 * Layout Schema: Defines required structure for each pattern
 */
export interface LayoutSchema {
    pattern: LayoutPattern;
    rootConstraints: {
        semanticRole?: string[];
        layoutPrimitive: string;
        dimensions?: {
            width: number;
            height: number;
        };
        constraints?: {
            width?: 'hug' | 'fill' | 'fixed';
            height?: 'hug' | 'fill' | 'fixed';
        };
    };
    childrenRules: ChildRule[];
    tailwindClasses?: string[];
}

export interface ChildRule {
    position: number | 'any' | 'first' | 'last';
    semanticRole?: string[];
    required: boolean;
    constraints?: {
        width?: 'hug' | 'fill' | 'fixed';
        height?: 'hug' | 'fill' | 'fixed';
    };
    layoutPrimitive?: string;
    maxWidth?: number;
    minWidth?: number;
}

/**
 * Predefined Layout Schemas
 */
export const LAYOUT_SCHEMAS: Record<LayoutPattern, LayoutSchema> = {

    desktop_default: {
        pattern: 'desktop_default',
        rootConstraints: {
            semanticRole: ['Desktop', 'Container', 'Page'],
            layoutPrimitive: 'stack-v',
            dimensions: { width: 1440, height: 860 }
        },
        childrenRules: [
            {
                position: 'any',
                required: false,
                constraints: { width: 'fill', height: 'hug' }
            }
        ]
    },

    two_column: {
        pattern: 'two_column',
        rootConstraints: {
            layoutPrimitive: 'stack-h'
        },
        childrenRules: [
            {
                position: 0,
                semanticRole: ['Sidebar', 'Navigation'],
                required: true,
                constraints: { width: 'fixed', height: 'fill' },
                layoutPrimitive: 'stack-v',
                maxWidth: 400,
                minWidth: 240
            },
            {
                position: 1,
                semanticRole: ['MainArea', 'Content', 'Container'],
                required: true,
                constraints: { width: 'fill', height: 'fill' },
                layoutPrimitive: 'stack-v'
            }
        ]
    },

    sidebar_main: {
        pattern: 'sidebar_main',
        rootConstraints: {
            layoutPrimitive: 'stack-h'
        },
        childrenRules: [
            {
                position: 'first',
                semanticRole: ['Sidebar'],
                required: true,
                constraints: { width: 'fixed', height: 'fill' },
                maxWidth: 280
            },
            {
                position: 'last',
                semanticRole: ['MainArea', 'Content'],
                required: true,
                constraints: { width: 'fill', height: 'fill' }
            }
        ]
    },

    dashboard_grid: {
        pattern: 'dashboard_grid',
        rootConstraints: {
            layoutPrimitive: 'stack-v'
        },
        childrenRules: [
            {
                position: 'any',
                semanticRole: ['Grid', 'CardGrid'],
                required: true,
                layoutPrimitive: 'grid-2-col'
            }
        ]
    },

    three_column: {
        pattern: 'three_column',
        rootConstraints: {
            layoutPrimitive: 'stack-h'
        },
        childrenRules: [
            {
                position: 0,
                required: true,
                constraints: { width: 'fixed', height: 'fill' },
                maxWidth: 280
            },
            {
                position: 1,
                required: true,
                constraints: { width: 'fill', height: 'fill' }
            },
            {
                position: 2,
                required: true,
                constraints: { width: 'fixed', height: 'fill' },
                maxWidth: 320
            }
        ]
    },

    header_content_footer: {
        pattern: 'header_content_footer',
        rootConstraints: {
            layoutPrimitive: 'stack-v'
        },
        childrenRules: [
            {
                position: 'first',
                semanticRole: ['Header', 'Navigation'],
                required: true,
                constraints: { width: 'fill', height: 'hug' }
            },
            {
                position: 1,
                semanticRole: ['MainArea', 'Content'],
                required: true,
                constraints: { width: 'fill', height: 'fill' }
            },
            {
                position: 'last',
                semanticRole: ['Footer'],
                required: false,
                constraints: { width: 'fill', height: 'hug' }
            }
        ]
    },

    split_view: {
        pattern: 'split_view',
        rootConstraints: {
            layoutPrimitive: 'stack-h',
            constraints: { width: 'fill', height: 'hug' }
        },
        childrenRules: [
            {
                position: 'any',
                required: true,
                constraints: { width: 'fill', height: 'fill' }
            }
        ]
    }
};