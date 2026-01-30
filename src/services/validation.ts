// REPLACE ENTIRE validation.ts WITH:
import { RSNT_Node } from '../types/rsnt';
import { ValidationRule } from '../rules/basic-rules';

export interface ValidationError {
    rule: string;
    message: string;
    location: string;
    severity: 'error' | 'warning';
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
}

/**
 * Validates an RSNT node tree against a set of rules.
 * Traverses the tree recursively.
 */
export function validateRSNT(rsnt: RSNT_Node, rules: ValidationRule[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    function traverse(node: RSNT_Node, path: string, parent?: RSNT_Node) {
        // Run all rules against the current node
        for (const rule of rules) {
            try {
                if (!rule.validate(node, parent)) {
                    const violation = {
                        rule: rule.id,
                        message: rule.message,
                        location: `${path} (${node.semanticRole})`,
                        severity: rule.severity
                    };

                    if (rule.severity === 'error') {
                        errors.push(violation);
                    } else {
                        warnings.push(violation);
                    }
                }
            } catch (e) {
                console.error(`Error running rule ${rule.id} on node ${node.id}:`, e);
            }
        }

        // Recursively validate children
        if (node.children && Array.isArray(node.children)) {
            node.children.forEach((child, index) => {
                traverse(child, `${path} > ${child.id || `child[${index}]`}`, node);
            });
        }
    }

    traverse(rsnt, rsnt.id || 'root');

    return {
        valid: errors.length === 0,  // Only errors block generation
        errors,
        warnings
    };
}