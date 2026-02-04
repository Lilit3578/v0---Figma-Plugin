# 5-Tier Resolution System - Quick Reference

## Import Statements

```typescript
// Resolution
import { 
  resolveNode, 
  ResolutionStatsCollector, 
  aggregateWarnings,
  ResolutionResult 
} from './services/resolution';

// Rendering
import { 
  executeInstructions, 
  renderWithResolution 
} from './services/rendering';

// Discovery
import { getOrDiscoverInventory } from './services/auto-discovery';
```

## Basic Usage

### 1. Resolve a Single Node

```typescript
const inventory = await getOrDiscoverInventory();
const result = await resolveNode(rsntNode, inventory);

console.log(`Tier: ${result.tier}`);
console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
console.log(`Method: ${result.method}`);
console.log(`Warnings: ${result.warnings.length}`);
```

### 2. Execute Resolution Instructions

```typescript
const figmaNode = await executeInstructions(result.instructions, rsntNode);

// Attach metadata
figmaNode.setPluginData('tier', result.tier.toString());
figmaNode.setPluginData('confidence', result.confidence.toString());
```

### 3. Batch Resolution with Statistics

```typescript
const stats = new ResolutionStatsCollector();
const resolutions: ResolutionResult[] = [];

for (const node of rsntNodes) {
  const result = await resolveNode(node, inventory);
  stats.record(result);
  resolutions.push(result);
}

// Print report
console.log(stats.getReport());

// Get structured stats
const data = stats.getStats();
console.log(`Tier 1 usage: ${data.tierCounts[1]} nodes`);
console.log(`Avg Tier 1 confidence: ${(data.averageConfidence[1] * 100).toFixed(1)}%`);
```

### 4. Aggregate Warnings

```typescript
const warnings = aggregateWarnings(resolutions);

console.log('Summary:', warnings.summary);

// Detailed warnings
warnings.componentWarnings.forEach(w => {
  console.log(`[Component] ${w.message} (${w.count}x)`);
});

warnings.variableWarnings.forEach(w => {
  console.log(`[Variable] ${w.message} (${w.count}x)`);
});

warnings.approximationWarnings.forEach(w => {
  console.log(`[Approximation] ${w.message} (${w.count}x)`);
});
```

### 5. Render with Progress

```typescript
const result = await renderWithResolution(
  resolutions,
  figma.currentPage,
  (progress) => {
    const percent = (progress.current / progress.total * 100).toFixed(0);
    console.log(`Rendering: ${percent}%`);
  },
  () => shouldCancel // Cancellation check
);

console.log(`Created ${result.node ? 'successfully' : 'with errors'}`);
console.log(`Errors: ${result.errors.length}`);
console.log(`Warnings: ${result.warnings.length}`);
```

## Tier Decision Logic

```typescript
// Tier 1: Exact Match
if (hasMatchingSemanticRole && propertyMappingRate >= 0.7) {
  return tier1Result; // Confidence: 0.8-1.0
}

// Tier 2: Structural Match
if (hasMatchingLayoutMode && isFlexibleComponent) {
  return tier2Result; // Confidence: 0.65-0.75
}

// Tier 3: Variable Construction
if (tailwindClassResolutionRate >= 0.7) {
  return tier3Result; // Confidence: 0.7-0.9
}

// Tier 4: Primitive Fallback
if (hasPrimitivesInFile) {
  return tier4Result; // Confidence: 0.4-0.6
}

// Tier 5: System Defaults (always)
return tier5Result; // Confidence: 0.3
```

## Instruction Types

### ComponentInstructions

```typescript
{
  type: 'INSTANTIATE_COMPONENT',
  componentId: string,
  properties: Record<string, any>,
  overrides?: {
    fills?: Paint[],
    strokes?: Paint[],
    text?: string,
    padding?: { top, right, bottom, left }
  }
}
```

### FrameInstructions

```typescript
{
  type: 'CREATE_FRAME',
  layoutMode: 'HORIZONTAL' | 'VERTICAL' | 'NONE',
  styling: {
    fills?: Paint[],
    strokes?: Paint[],
    cornerRadius?: number,
    padding?: { top, right, bottom, left }
  },
  variableBindings?: Record<string, string>, // Tier 3
  primitiveValues?: Record<string, any>      // Tier 4-5
}
```

## Confidence Interpretation

| Tier | Range | Meaning |
|------|-------|---------|
| 1 | 0.8-1.0 | Exact match, high quality |
| 2 | 0.65-0.75 | Structural match, good quality |
| 3 | 0.7-0.9 | Token-based, good quality |
| 4 | 0.4-0.6 | Approximation, acceptable |
| 5 | 0.3 | Generic defaults, low quality |

## Common Patterns

### Pattern 1: Resolve Tree Recursively

```typescript
async function resolveTree(
  node: RSNT_Node, 
  inventory: DesignSystemInventory,
  stats: ResolutionStatsCollector
): Promise<ResolutionResult[]> {
  const results: ResolutionResult[] = [];
  
  const result = await resolveNode(node, inventory);
  stats.record(result);
  results.push(result);
  
  if (node.children) {
    for (const child of node.children) {
      const childResults = await resolveTree(child, inventory, stats);
      results.push(...childResults);
    }
  }
  
  return results;
}
```

### Pattern 2: Filter by Confidence

```typescript
const highConfidence = resolutions.filter(r => r.confidence >= 0.7);
const lowConfidence = resolutions.filter(r => r.confidence < 0.5);

console.log(`High confidence: ${highConfidence.length}`);
console.log(`Low confidence: ${lowConfidence.length}`);
```

### Pattern 3: Group by Tier

```typescript
const byTier = resolutions.reduce((acc, r) => {
  if (!acc[r.tier]) acc[r.tier] = [];
  acc[r.tier].push(r);
  return acc;
}, {} as Record<number, ResolutionResult[]>);

console.log(`Tier 1: ${byTier[1]?.length || 0} nodes`);
console.log(`Tier 5: ${byTier[5]?.length || 0} nodes`);
```

### Pattern 4: Detect Quality Issues

```typescript
const qualityIssues = resolutions.filter(r => 
  r.tier >= 4 || r.confidence < 0.5 || r.warnings.length > 0
);

if (qualityIssues.length > 0) {
  console.warn(`⚠️ ${qualityIssues.length} nodes have quality issues`);
  
  qualityIssues.forEach(r => {
    console.log(`- Node ${r.metadata?.nodeId}: Tier ${r.tier}, ${r.warnings.length} warnings`);
  });
}
```

## Debugging

### Enable Verbose Logging

```typescript
// In resolution.ts, add console.log statements:
console.log(`[Tier 1] Checking ${candidates.length} candidates`);
console.log(`[Tier 2] Found ${flexibleCandidates.length} flexible components`);
console.log(`[Tier 3] Resolved ${successful.length}/${classes.length} classes`);
```

### Inspect Resolution Metadata

```typescript
const result = await resolveNode(node, inventory);

console.log('Resolution Details:');
console.log('  Tier:', result.tier);
console.log('  Method:', result.method);
console.log('  Confidence:', result.confidence);
console.log('  Time:', result.metadata?.timeMs, 'ms');
console.log('  Fallback Reason:', result.metadata?.fallbackReason);
console.log('  Warnings:', result.warnings);
```

### Check Instruction Type

```typescript
if (result.instructions.type === 'INSTANTIATE_COMPONENT') {
  const inst = result.instructions as ComponentInstructions;
  console.log('Component:', inst.componentId);
  console.log('Properties:', inst.properties);
  console.log('Has overrides:', !!inst.overrides);
} else {
  const inst = result.instructions as FrameInstructions;
  console.log('Layout:', inst.layoutMode);
  console.log('Has variables:', !!inst.variableBindings);
  console.log('Has primitives:', !!inst.primitiveValues);
}
```

## Performance Tips

1. **Cache Inventory**: Call `getOrDiscoverInventory()` once, reuse for all nodes
2. **Batch Processing**: Use `processInChunks()` for large trees
3. **Parallel Resolution**: Resolve independent nodes in parallel
4. **Early Exit**: Check Tier 1 first (fastest, most common)

## Error Handling

```typescript
try {
  const result = await resolveNode(node, inventory);
  const figmaNode = await executeInstructions(result.instructions, node);
  
  // Success
  console.log(`✓ Created node with Tier ${result.tier}`);
  
} catch (error) {
  console.error('Resolution failed:', error);
  
  // Fallback: Use Tier 5 directly
  const fallback = tryTier5SystemDefaults(node);
  const figmaNode = await executeInstructions(fallback.instructions, node);
  
  console.log('✓ Used Tier 5 fallback');
}
```

## Testing

```typescript
import { resolveNode } from './services/resolution';

describe('Resolution System', () => {
  it('should always succeed', async () => {
    const result = await resolveNode(anyNode, anyInventory);
    expect(result.success).toBe(true);
  });
  
  it('should use Tier 1 for exact matches', async () => {
    const result = await resolveNode(nodeWithExactMatch, inventory);
    expect(result.tier).toBe(1);
    expect(result.confidence).toBeGreaterThan(0.8);
  });
  
  it('should fall back to Tier 5 when needed', async () => {
    const result = await resolveNode(nodeWithNoMatches, emptyInventory);
    expect(result.tier).toBe(5);
    expect(result.confidence).toBe(0.3);
  });
});
```
