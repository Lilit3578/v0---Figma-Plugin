/**
 * Tailwind CSS v3 Default Design Tokens
 * Used as Tier 5 fallback when no design system assets are found
 */

export const TAILWIND_DEFAULTS = {
    colors: {
        // Slate
        'slate-50': '#F8FAFC',
        'slate-100': '#F1F5F9',
        'slate-200': '#E2E8F0',
        'slate-300': '#CBD5E1',
        'slate-400': '#94A3B8',
        'slate-500': '#64748B',
        'slate-600': '#475569',
        'slate-700': '#334155',
        'slate-800': '#1E293B',
        'slate-900': '#0F172A',

        // Gray
        'gray-50': '#F9FAFB',
        'gray-100': '#F3F4F6',
        'gray-200': '#E5E7EB',
        'gray-300': '#D1D5DB',
        'gray-400': '#9CA3AF',
        'gray-500': '#6B7280',
        'gray-600': '#4B5563',
        'gray-700': '#374151',
        'gray-800': '#1F2937',
        'gray-900': '#111827',

        // Zinc
        'zinc-50': '#FAFAFA',
        'zinc-100': '#F4F4F5',
        'zinc-200': '#E4E4E7',
        'zinc-300': '#D4D4D8',
        'zinc-400': '#A1A1AA',
        'zinc-500': '#71717A',
        'zinc-600': '#52525B',
        'zinc-700': '#3F3F46',
        'zinc-800': '#27272A',
        'zinc-900': '#18181B',

        // Red
        'red-50': '#FEF2F2',
        'red-100': '#FEE2E2',
        'red-200': '#FECACA',
        'red-300': '#FCA5A5',
        'red-400': '#F87171',
        'red-500': '#EF4444',
        'red-600': '#DC2626',
        'red-700': '#B91C1C',
        'red-800': '#991B1B',
        'red-900': '#7F1D1D',

        // Orange
        'orange-50': '#FFF7ED',
        'orange-100': '#FFEDD5',
        'orange-200': '#FED7AA',
        'orange-300': '#FDBA74',
        'orange-400': '#FB923C',
        'orange-500': '#F97316',
        'orange-600': '#EA580C',
        'orange-700': '#C2410C',
        'orange-800': '#9A3412',
        'orange-900': '#7C2D12',

        // Amber
        'amber-50': '#FFFBEB',
        'amber-100': '#FEF3C7',
        'amber-200': '#FDE68A',
        'amber-300': '#FCD34D',
        'amber-400': '#FBBF24',
        'amber-500': '#F59E0B',
        'amber-600': '#D97706',
        'amber-700': '#B45309',
        'amber-800': '#92400E',
        'amber-900': '#78350F',

        // Yellow
        'yellow-50': '#FEFCE8',
        'yellow-100': '#FEF9C3',
        'yellow-200': '#FEF08A',
        'yellow-300': '#FDE047',
        'yellow-400': '#FACC15',
        'yellow-500': '#EAB308',
        'yellow-600': '#CA8A04',
        'yellow-700': '#A16207',
        'yellow-800': '#854D0E',
        'yellow-900': '#713F12',

        // Lime
        'lime-50': '#F7FEE7',
        'lime-100': '#ECFCCB',
        'lime-200': '#D9F99D',
        'lime-300': '#BEF264',
        'lime-400': '#A3E635',
        'lime-500': '#84CC16',
        'lime-600': '#65A30D',
        'lime-700': '#4D7C0F',
        'lime-800': '#3F6212',
        'lime-900': '#365314',

        // Green
        'green-50': '#F0FDF4',
        'green-100': '#DCFCE7',
        'green-200': '#BBF7D0',
        'green-300': '#86EFAC',
        'green-400': '#4ADE80',
        'green-500': '#22C55E',
        'green-600': '#16A34A',
        'green-700': '#15803D',
        'green-800': '#166534',
        'green-900': '#14532D',

        // Emerald
        'emerald-50': '#ECFDF5',
        'emerald-100': '#D1FAE5',
        'emerald-200': '#A7F3D0',
        'emerald-300': '#6EE7B7',
        'emerald-400': '#34D399',
        'emerald-500': '#10B981',
        'emerald-600': '#059669',
        'emerald-700': '#047857',
        'emerald-800': '#065F46',
        'emerald-900': '#064E3B',

        // Teal
        'teal-50': '#F0FDFA',
        'teal-100': '#CCFBF1',
        'teal-200': '#99F6E4',
        'teal-300': '#5EEAD4',
        'teal-400': '#2DD4BF',
        'teal-500': '#14B8A6',
        'teal-600': '#0D9488',
        'teal-700': '#0F766E',
        'teal-800': '#115E59',
        'teal-900': '#134E4A',

        // Cyan
        'cyan-50': '#ECFEFF',
        'cyan-100': '#CFFAFE',
        'cyan-200': '#A5F3FC',
        'cyan-300': '#67E8F9',
        'cyan-400': '#22D3EE',
        'cyan-500': '#06B6D4',
        'cyan-600': '#0891B2',
        'cyan-700': '#0E7490',
        'cyan-800': '#155E75',
        'cyan-900': '#164E63',

        // Sky
        'sky-50': '#F0F9FF',
        'sky-100': '#E0F2FE',
        'sky-200': '#BAE6FD',
        'sky-300': '#7DD3FC',
        'sky-400': '#38BDF8',
        'sky-500': '#0EA5E9',
        'sky-600': '#0284C7',
        'sky-700': '#0369A1',
        'sky-800': '#075985',
        'sky-900': '#0C4A6E',

        // Blue
        'blue-50': '#EFF6FF',
        'blue-100': '#DBEAFE',
        'blue-200': '#BFDBFE',
        'blue-300': '#93C5FD',
        'blue-400': '#60A5FA',
        'blue-500': '#3B82F6',
        'blue-600': '#2563EB',
        'blue-700': '#1D4ED8',
        'blue-800': '#1E40AF',
        'blue-900': '#1E3A8A',

        // Indigo
        'indigo-50': '#EEF2FF',
        'indigo-100': '#E0E7FF',
        'indigo-200': '#C7D2FE',
        'indigo-300': '#A5B4FC',
        'indigo-400': '#818CF8',
        'indigo-500': '#6366F1',
        'indigo-600': '#4F46E5',
        'indigo-700': '#4338CA',
        'indigo-800': '#3730A3',
        'indigo-900': '#312E81',

        // Violet
        'violet-50': '#F5F3FF',
        'violet-100': '#EDE9FE',
        'violet-200': '#DDD6FE',
        'violet-300': '#C4B5FD',
        'violet-400': '#A78BFA',
        'violet-500': '#8B5CF6',
        'violet-600': '#7C3AED',
        'violet-700': '#6D28D9',
        'violet-800': '#5B21B6',
        'violet-900': '#4C1D95',

        // Purple
        'purple-50': '#FAF5FF',
        'purple-100': '#F3E8FF',
        'purple-200': '#E9D5FF',
        'purple-300': '#D8B4FE',
        'purple-400': '#C084FC',
        'purple-500': '#A855F7',
        'purple-600': '#9333EA',
        'purple-700': '#7E22CE',
        'purple-800': '#6B21A8',
        'purple-900': '#581C87',

        // Fuchsia
        'fuchsia-50': '#FDF4FF',
        'fuchsia-100': '#FAE8FF',
        'fuchsia-200': '#F5D0FE',
        'fuchsia-300': '#F0ABFC',
        'fuchsia-400': '#E879F9',
        'fuchsia-500': '#D946EF',
        'fuchsia-600': '#C026D3',
        'fuchsia-700': '#A21CAF',
        'fuchsia-800': '#86198F',
        'fuchsia-900': '#701A75',

        // Pink
        'pink-50': '#FDF2F8',
        'pink-100': '#FCE7F3',
        'pink-200': '#FBCFE8',
        'pink-300': '#F9A8D4',
        'pink-400': '#F472B6',
        'pink-500': '#EC4899',
        'pink-600': '#DB2777',
        'pink-700': '#BE185D',
        'pink-800': '#9D174D',
        'pink-900': '#831843',

        // Rose
        'rose-50': '#FFF1F2',
        'rose-100': '#FFE4E6',
        'rose-200': '#FECDD3',
        'rose-300': '#FDA4AF',
        'rose-400': '#FB7185',
        'rose-500': '#F43F5E',
        'rose-600': '#E11D48',
        'rose-700': '#BE123C',
        'rose-800': '#9F1239',
        'rose-900': '#881337',

        // Special colors
        'white': '#FFFFFF',
        'black': '#000000',
        'transparent': 'transparent',
    },

    spacing: {
        '0': 0,
        'px': 1,
        '0.5': 2,
        '1': 4,
        '1.5': 6,
        '2': 8,
        '2.5': 10,
        '3': 12,
        '3.5': 14,
        '4': 16,
        '5': 20,
        '6': 24,
        '7': 28,
        '8': 32,
        '9': 36,
        '10': 40,
        '11': 44,
        '12': 48,
        '14': 56,
        '16': 64,
        '20': 80,
        '24': 96,
        '28': 112,
        '32': 128,
        '36': 144,
        '40': 160,
        '44': 176,
        '48': 192,
        '52': 208,
        '56': 224,
        '60': 240,
        '64': 256,
        '72': 288,
        '80': 320,
        '96': 384,
    },

    borderRadius: {
        'none': 0,
        'sm': 2,
        'DEFAULT': 4,
        'md': 6,
        'lg': 8,
        'xl': 12,
        '2xl': 16,
        '3xl': 24,
        'full': 9999,
    },

    fontSize: {
        'xs': 12,
        'sm': 14,
        'base': 16,
        'lg': 18,
        'xl': 20,
        '2xl': 24,
        '3xl': 30,
        '4xl': 36,
        '5xl': 48,
        '6xl': 60,
        '7xl': 72,
        '8xl': 96,
        '9xl': 128,
    },

    fontWeight: {
        'thin': 100,
        'extralight': 200,
        'light': 300,
        'normal': 400,
        'medium': 500,
        'semibold': 600,
        'bold': 700,
        'extrabold': 800,
        'black': 900,
    },

    lineHeight: {
        'none': 1,
        'tight': 1.25,
        'snug': 1.375,
        'normal': 1.5,
        'relaxed': 1.625,
        'loose': 2,
    },

    letterSpacing: {
        'tighter': -0.8,
        'tight': -0.4,
        'normal': 0,
        'wide': 0.4,
        'wider': 0.8,
        'widest': 1.6,
    },
};

/**
 * Helper to get color value from Tailwind class
 * Example: 'bg-blue-500' -> '#3B82F6'
 */
export function getTailwindColor(className: string): string | null {
    const match = className.match(/(?:bg|text|border)-(\w+-\d+)/);
    if (match && match[1]) {
        return TAILWIND_DEFAULTS.colors[match[1] as keyof typeof TAILWIND_DEFAULTS.colors] || null;
    }
    return null;
}

/**
 * Helper to get spacing value from Tailwind class
 * Example: 'p-4' -> 16
 */
export function getTailwindSpacing(className: string): number | null {
    const match = className.match(/(?:p|m|gap|space)-(\w+)/);
    if (match && match[1]) {
        return TAILWIND_DEFAULTS.spacing[match[1] as keyof typeof TAILWIND_DEFAULTS.spacing] ?? null;
    }
    return null;
}

/**
 * Helper to get border radius from Tailwind class
 * Example: 'rounded-lg' -> 8
 */
export function getTailwindRadius(className: string): number | null {
    const match = className.match(/rounded(?:-(\w+))?/);
    const key = match?.[1] || 'DEFAULT';
    return TAILWIND_DEFAULTS.borderRadius[key as keyof typeof TAILWIND_DEFAULTS.borderRadius] ?? null;
}
