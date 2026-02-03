/**
 * Constants for RSNT validation rules
 */

export const MAX_NESTING_DEPTH = 8;

export const APPROVED_SEMANTIC_ROLES = new Set([
    'button',
    'input',
    'label',
    'card',
    'form',
    'container',
    'header',
    'footer',
    'navigation',
    'nav',
    'list',
    'list-item',
    'image',
    'text',
    'icon',
    'link',
    'section',
    'article',
    'main',
    'aside',
    'dialog',
    'modal',
    'alert',
    'badge',
    'chip',
    'divider',
    'avatar',
    'toolbar',
    'menu',
    'menu-item',
    'tab',
    'tab-panel',
    'accordion',
    'tooltip',
    'popover',
    'dropdown',
]);

export const APPROVED_LAYOUT_PRIMITIVES = new Set([
    'auto-layout',
    'stack',
    'grid',
    'absolute',
    'wrap',
    'flex',
    'inline',
    'block',
]);

export const REQUIRED_PROPS_BY_TYPE: Record<string, string[]> = {
    'COMPONENT_INSTANCE': ['componentId'],
    'FRAME': [],
    'TEXT': ['characters'],
};

export const REQUIRED_PROPS_BY_ROLE: Record<string, string[]> = {
    'input': ['type'],
    'label': ['text', 'htmlFor'],
    'button': ['text', 'variant'],
    'link': ['href'],
    'image': ['src', 'alt'],
};

// Common Tailwind classes for validation (subset)
export const COMMON_TAILWIND_CLASSES = new Set([
    // Display
    'flex', 'inline-flex', 'grid', 'inline-grid', 'block', 'inline-block', 'inline', 'hidden',

    // Flexbox
    'flex-row', 'flex-col', 'flex-wrap', 'flex-nowrap',
    'items-start', 'items-center', 'items-end', 'items-stretch',
    'justify-start', 'justify-center', 'justify-end', 'justify-between', 'justify-around',
    'gap-0', 'gap-1', 'gap-2', 'gap-3', 'gap-4', 'gap-5', 'gap-6', 'gap-8', 'gap-10',

    // Text sizes
    'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl',

    // Font weights
    'font-thin', 'font-light', 'font-normal', 'font-medium', 'font-semibold', 'font-bold',

    // Text alignment
    'text-left', 'text-center', 'text-right', 'text-justify',

    // Colors (common patterns)
    'text-white', 'text-black', 'text-gray-50', 'text-gray-100', 'text-gray-200', 'text-gray-300',
    'text-gray-400', 'text-gray-500', 'text-gray-600', 'text-gray-700', 'text-gray-800', 'text-gray-900',
    'bg-white', 'bg-black', 'bg-transparent',
    'bg-gray-50', 'bg-gray-100', 'bg-gray-200', 'bg-gray-300', 'bg-gray-400', 'bg-gray-500',
    'bg-gray-600', 'bg-gray-700', 'bg-gray-800', 'bg-gray-900',
    'bg-blue-50', 'bg-blue-100', 'bg-blue-200', 'bg-blue-300', 'bg-blue-400', 'bg-blue-500',
    'bg-blue-600', 'bg-blue-700', 'bg-blue-800', 'bg-blue-900',
    'bg-red-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500',

    // Padding
    'p-0', 'p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6', 'p-8', 'p-10', 'p-12',
    'px-0', 'px-1', 'px-2', 'px-3', 'px-4', 'px-5', 'px-6', 'px-8', 'px-10',
    'py-0', 'py-1', 'py-2', 'py-3', 'py-4', 'py-5', 'py-6', 'py-8', 'py-10',
    'pt-0', 'pt-1', 'pt-2', 'pt-4', 'pt-6', 'pt-8',
    'pr-0', 'pr-1', 'pr-2', 'pr-4', 'pr-6', 'pr-8',
    'pb-0', 'pb-1', 'pb-2', 'pb-4', 'pb-6', 'pb-8',
    'pl-0', 'pl-1', 'pl-2', 'pl-4', 'pl-6', 'pl-8',

    // Margin
    'm-0', 'm-1', 'm-2', 'm-3', 'm-4', 'm-5', 'm-6', 'm-8', 'm-10',
    'mx-0', 'mx-1', 'mx-2', 'mx-3', 'mx-4', 'mx-5', 'mx-6', 'mx-8', 'mx-auto',
    'my-0', 'my-1', 'my-2', 'my-3', 'my-4', 'my-5', 'my-6', 'my-8',
    'mt-0', 'mt-1', 'mt-2', 'mt-4', 'mt-6', 'mt-8',
    'mr-0', 'mr-1', 'mr-2', 'mr-4', 'mr-6', 'mr-8',
    'mb-0', 'mb-1', 'mb-2', 'mb-4', 'mb-6', 'mb-8',
    'ml-0', 'ml-1', 'ml-2', 'ml-4', 'ml-6', 'ml-8',

    // Width/Height
    'w-full', 'w-auto', 'w-screen', 'w-1/2', 'w-1/3', 'w-2/3', 'w-1/4', 'w-3/4',
    'h-full', 'h-auto', 'h-screen', 'h-1/2', 'h-1/3', 'h-2/3', 'h-1/4', 'h-3/4',

    // Border radius
    'rounded', 'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-full',
    'rounded-none',

    // Shadows
    'shadow', 'shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl', 'shadow-none',

    // Border
    'border', 'border-0', 'border-2', 'border-4', 'border-8',
    'border-solid', 'border-dashed', 'border-dotted',
    'border-gray-200', 'border-gray-300', 'border-gray-400',

    // Position
    'relative', 'absolute', 'fixed', 'sticky', 'static',

    // Overflow
    'overflow-hidden', 'overflow-auto', 'overflow-scroll', 'overflow-visible',

    // Cursor
    'cursor-pointer', 'cursor-default', 'cursor-not-allowed',

    // Opacity
    'opacity-0', 'opacity-25', 'opacity-50', 'opacity-75', 'opacity-100',
]);

// Tailwind class prefixes for pattern matching
export const TAILWIND_CLASS_PREFIXES = [
    'text-', 'bg-', 'border-', 'p-', 'px-', 'py-', 'pt-', 'pr-', 'pb-', 'pl-',
    'm-', 'mx-', 'my-', 'mt-', 'mr-', 'mb-', 'ml-', 'w-', 'h-', 'gap-',
    'rounded-', 'shadow-', 'font-', 'flex-', 'grid-', 'items-', 'justify-',
    'opacity-', 'hover:', 'focus:', 'active:', 'disabled:', 'group-hover:',
];

/**
 * Check if a Tailwind class is valid (either exact match or prefix match)
 */
export function isValidTailwindClass(className: string): boolean {
    // Check exact match
    if (COMMON_TAILWIND_CLASSES.has(className)) {
        return true;
    }

    // Check prefix match (for dynamic classes like text-gray-500, p-4, etc.)
    return TAILWIND_CLASS_PREFIXES.some(prefix => className.startsWith(prefix));
}
