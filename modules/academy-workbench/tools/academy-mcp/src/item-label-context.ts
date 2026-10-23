export function freezeLabelData<T>(value:T):T {if(value&&typeof value==='object'){Object.values(value).forEach(freezeLabelData);Object.freeze(value);}return value;}
/** Current user's task, not an imported authorization or a claim about source truth. */
export const itemLabelUserContext=freezeLabelData({
  schemaVersion:'academy.item-label-user-context/1',
  source:'current_user_direction_2026-10-16',
  purpose:'After studying detailed month-end question types, find existing Academy labels most similar to the desired question features.',
  confirmedDiscoveryOrder:['Find the existing type label first','Review existing questions under the chosen type','The user chooses final exam questions separately'],
  identityRules:['pat_no/pat_name identify a type label; lecture_key identifies an individual question.',
    'Keep type labels, individual questions, source papers and saved pools as separate identities.'],
  workflow:['study_detailed_types','declare_desired_question_features','resolve_exact_existing_hierarchy','retrieve_and_compare_existing_labels','teacher_reviews_actual_questions'],
  comparisonAxes:['mathematical_structure','required_reasoning','representation','number_range','response_mode'],
  callerContext:['Exact returned hierarchy IDs','Desired question features in the teacher\'s words','Teacher-reported learning state; never invent completion'],
  requirements:{schoolStage:'elementary',grade:3,month:10,responseMode:'constructed_response',questions:24,totalPoints:100,
    pointBands:[{points:3,questions:12},{points:5,questions:8},{points:6,questions:4}],startTime:'15:00',durationMinutes:80,
    exactDate:'unknown',timeZone:'unknown',editionAndUnitScope:'unknown'},
  interpretation:['Reuse exact existing hierarchy; do not infer replacement IDs or taxonomy.',
    'Lexical label retrieval narrows candidates; it is not a semantic similarity evaluation or final item selection.',
    'Preserve source revision, observed time, exact labels, coverage and comparison reasons.',
    'The teacher decides whether type study is complete and which existing questions are suitable.',
    'Live Academy behavior must be verified separately; synthetic tests never close that gate.'],
  boundaries:{academySource:'read_only',questionGeneration:false,finalQuestionMembership:false,printing:false,parentSend:false,
    publicFrontendData:'synthetic_only',sharedDatabaseTopology:'user_hypothesis_unverified'},
});
