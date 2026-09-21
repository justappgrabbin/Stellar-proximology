export function createIntegrationPlanningGoal({
  title = 'Integrate existing systems without replacing them',
  systems = [],
  constraints = []
} = {}) {
  return {
    statement: title,
    domain: 'integration',
    mode: 'preservation-first',
    systems,
    constraints: [
      'preserve existing systems whole',
      'reuse existing interfaces before adding adapters',
      'do not replace working components',
      'test real input -> output -> state flow before calling it wired',
      ...constraints
    ],
    indicators: [
      {
        id: 'inventory',
        name: 'Systems inventoried',
        direction: 'increase'
      },
      {
        id: 'interfaces',
        name: 'Existing interfaces mapped',
        direction: 'increase'
      },
      {
        id: 'bindings',
        name: 'Cross-system bindings exercised',
        direction: 'increase'
      },
      {
        id: 'verified',
        name: 'End-to-end paths verified',
        direction: 'increase'
      }
    ]
  };
}

export default createIntegrationPlanningGoal;
