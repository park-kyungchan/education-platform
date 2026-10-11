import {SQL} from 'bun';
import {PostgresAcademyStore} from '../../src/academy/postgresStore';
/** Seed each independent integration suite; never depend on Bun's cross-file execution order. */
export async function ensureSyntheticStudentFixture(){
  const socket=process.env.DC_ACADEMY_TEST_SOCKET;if(!socket)throw Error('synthetic_test_socket_required');
  const db=new SQL({adapter:'postgres',path:socket,username:'hermes',database:'dc_academy_test'});
  try{
    const store=new PostgresAcademyStore(db);await store.migrate();
    await store.registerStudent({ownerId:'fixture-owner-a',id:'fixture-student-a',displayName:'Invented Learner',sourceKey:{namespace:'academy_student',literalKey:'91001'},proofRefs:['synthetic-independent-course-and-book-binding']});
  }finally{await db.close();}
}
