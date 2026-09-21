export async function promotePlanToStellarProject({
  computer,
  person_id,
  creator_id,
  title = null,
  description = null,
  category = 'project',
  project_type = 'project'
} = {}) {
  if (!computer || typeof computer.invoke !== 'function') {
    throw new TypeError('promotePlanToStellarProject requires the existing Stellar Comp instance');
  }
  if (!person_id || !creator_id) {
    throw new TypeError('person_id and creator_id are required');
  }

  const summary = await computer.invoke({
    requester: creator_id,
    capability: 'planning.summary',
    input: { person_id }
  });

  const statement =
    title ||
    summary?.purpose?.statement ||
    summary?.statement ||
    summary?.purpose ||
    'Untitled Stellar project';

  const projectDescription =
    description ||
    summary?.description ||
    summary?.purpose?.description ||
    (typeof summary === 'string' ? summary : JSON.stringify(summary, null, 2));

  const project = await computer.invoke({
    requester: creator_id,
    capability: 'stellar.project.create',
    input: {
      creator_id,
      title: String(statement).slice(0, 200),
      description: String(projectDescription).slice(0, 8000),
      category,
      project_type
    }
  });

  return {
    ok: true,
    person_id,
    creator_id,
    planningSummary: summary,
    stellarProject: project
  };
}

export default promotePlanToStellarProject;
