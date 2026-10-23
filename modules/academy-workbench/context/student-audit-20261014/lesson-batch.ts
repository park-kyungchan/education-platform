/** Domain provenance topology only; does not create shared artifacts or permissions. */
export type EvidenceNodeKind='student'|'book_edition'|'teacher_event'|'source_message'|'server_observation'|'rubric'|'planning_proposal'|'draft'|'coverage';
export interface EvidenceNode {id:string;kind:EvidenceNodeKind;studentId:string|null;path:string|null;pointer:string|null;}
export interface EvidenceEdge {from:string;to:string;relation:'scoped_to'|'derived_from'|'applies_to'|'documents';}
export interface LessonTopology {schemaVersion:'academy.lesson-topology/1';cutoff:string;authority:'none';nodes:EvidenceNode[];edges:EvidenceEdge[];}
export function validateLessonTopology(x:LessonTopology){
 if(x.schemaVersion!=='academy.lesson-topology/1'||x.authority!=='none'||!Number.isFinite(Date.parse(x.cutoff)))throw Error('lesson_topology_identity');
 const nodes=new Map(x.nodes.map(n=>[n.id,n]));if(nodes.size!==x.nodes.length)throw Error('duplicate_node');
 for(const n of x.nodes){if(!n.id||n.path&&(!n.path.startsWith('private/')||n.path.split('/').includes('..')))throw Error('unsafe_reference');}
 for(const e of x.edges){const from=nodes.get(e.from),to=nodes.get(e.to);if(!from||!to)throw Error('dangling_evidence_edge');if(from.studentId&&to.studentId&&from.studentId!==to.studentId)throw Error('cross_student_evidence_edge');}
 return x;
}
