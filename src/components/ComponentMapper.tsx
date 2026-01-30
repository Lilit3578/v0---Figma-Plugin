import React, { useState, useEffect } from 'react';
import { ComponentMetadata } from '../services/discovery';
import { SemanticRole } from '../types/rsnt';

interface ComponentMapperProps {
    discoveredComponents: ComponentMetadata[];
    initialMappings: Record<string, string>;
    onSave: (mappings: Record<string, string>) => void;
    onReset: () => void;
}

const SEMANTIC_ROLES: SemanticRole[] = [
    "PrimaryButton", "SecondaryButton", "GhostButton",
    "Card", "Container", "Section",
    "Form", "FormField", "Input", "Label",
    "Heading", "Paragraph", "Icon", "Image"
];

export const ComponentMapper: React.FC<ComponentMapperProps> = ({
    discoveredComponents,
    initialMappings,
    onSave,
    onReset
}) => {
    const [mappings, setMappings] = useState<Record<string, string>>(initialMappings);

    const handleMappingChange = (componentId: string, role: string) => {
        setMappings(prev => ({
            ...prev,
            [componentId]: role
        }));
    };

    const clearMapping = (componentId: string) => {
        const newMappings = { ...mappings };
        delete newMappings[componentId];
        setMappings(newMappings);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #e6e6e6', paddingBottom: '8px' }}>
                <div style={{ flex: 1, fontWeight: 600 }}>Your Components</div>
                <div style={{ flex: 1, fontWeight: 600 }}>Maps To (Semantic Role)</div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {discoveredComponents.map(comp => (
                    <div key={comp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {comp.name}
                        </div>
                        <div style={{ flex: 1, display: 'flex', gap: '4px' }}>
                            <select
                                value={mappings[comp.id] || ''}
                                onChange={(e) => handleMappingChange(comp.id, e.target.value)}
                                style={{ flex: 1, fontSize: '11px', padding: '4px' }}
                            >
                                <option value="">Unmapped</option>
                                {SEMANTIC_ROLES.map(role => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </select>
                            {mappings[comp.id] && (
                                <button
                                    onClick={() => clearMapping(comp.id)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f24822' }}
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {discoveredComponents.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                        No components discovered yet. Scan the file first.
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #e6e6e6', paddingTop: '12px' }}>
                <button
                    onClick={() => onSave(mappings)}
                    style={{ flex: 1, backgroundColor: '#18a0fb', color: 'white', border: 'none', borderRadius: '6px', padding: '8px', cursor: 'pointer' }}
                >
                    Save Mappings
                </button>
                <button
                    onClick={onReset}
                    style={{ backgroundColor: '#f0f0f0', border: 'none', borderRadius: '6px', padding: '8px', cursor: 'pointer' }}
                >
                    Reset
                </button>
            </div>
        </div>
    );
};
